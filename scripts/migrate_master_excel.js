/**
 * Step 2-4 통합 마이그레이션 스크립트
 * 엑셀 마스터 파일을 기준으로 account_entities, certificate_registry, membership_roles, entity_relationships를 동기화합니다.
 */
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXCEL_PATH = 'data/최종 권리증 프로그램용_260311.xlsx';

// 전화번호 정규화 (하이픈 제거 및 형식 통일)
function normalizePhone(phone) {
    if (!phone) return null;
    const cleaned = String(phone).replace(/[^0-9]/g, '');
    if (!cleaned) return null;
    return cleaned;
}

// 이름 정규화
function normalizeName(name) {
    if (!name) return '';
    return String(name).trim();
}

async function migrate() {
    console.log('--- 마스터 엑셀 마이그레이션 시작 ---');

    // 1. 엑셀 파일 로드
    const wb = xlsx.readFile(EXCEL_PATH);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { range: 1 });
    console.log(`기본 로드된 행: ${rows.length}개`);

    // 2. 현재 DB 정보 로드
    const { data: allEntities } = await supabase.from('account_entities').select('*');
    const entityMap = new Map(); // name -> Entity[]
    allEntities.forEach(e => {
        const key = normalizeName(e.display_name);
        if (!entityMap.has(key)) entityMap.set(key, []);
        entityMap.get(key).push(e);
    });

    // 3. 기존 certificate_registry 비우기
    console.log('certificate_registry 초기화 중...');
    const { error: truncErr } = await supabase.from('certificate_registry').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (truncErr) console.warn('Registry 초기화 경고:', truncErr.message);

    const results = {
        matched: 0,
        new: 0,
        multiMatchSolved: 0,
        multiMatchUnsolved: 0,
        certInserted: 0
    };

    // 4. 행별 처리
    for (const row of rows) {
        const rawName = row['성명'];
        if (!rawName) continue;

        const name = normalizeName(rawName);
        const phone = normalizePhone(row['연락처']);
        const address = row['주소'] || '';
        const group = row['평형'] ? String(row['평형']) : null;
        const isExit = row['탈퇴'] === '탈퇴';
        const category = row['분류'] || '기타';

        let targetId = null;
        const candidates = entityMap.get(name) || [];

        if (candidates.length === 1) {
            targetId = candidates[0].id;
            results.matched++;
        } else if (candidates.length > 1) {
            // 연락처로 2차 매칭 시도
            const matchedByPhone = candidates.find(c => normalizePhone(c.phone) === phone && phone);
            if (matchedByPhone) {
                targetId = matchedByPhone.id;
                results.multiMatchSolved++;
            } else {
                // 연락처도 없거나 안맞으면 첫번째 후보 (리스크 있지만 동명이인 구분을 위해)
                targetId = candidates[0].id;
                results.multiMatchUnsolved++;
            }
        } else {
            // 신규 생성
            const { data: newEntity, error: createErr } = await supabase
                .from('account_entities')
                .insert({
                    display_name: name,
                    phone: row['연락처'] || null,
                    address_legal: address || null,
                    unit_group: group,
                    status: isExit ? '탈퇴' : '정상',
                    meta: { sync_source: 'excel_master_260311' }
                })
                .select()
                .single();
            
            if (createErr) {
                console.error(`신규 생성 실패 (${name}):`, createErr.message);
                continue;
            }
            targetId = newEntity.id;
            results.new++;
        }

        // 인물 정보 업데이트 (엑셀 기준으로 갱신)
        await supabase.from('account_entities').update({
            address_legal: address || undefined,
            unit_group: group || undefined,
            status: isExit ? '탈퇴' : '정상'
        }).eq('id', targetId);

        // 5. 권리증 등록
        const certNumber = row['권리증번호'];
        if (certNumber) {
            const certStatus = row['권리증보유현황'] === '보유' ? 'confirmed' : 'review_required';
            
            let certInfo = {};
            const rawCertInfo = row['권리증정보'];
            if (rawCertInfo) {
                try {
                    // JSON 부분만 추출 시도 ({...})
                    const jsonMatch = String(rawCertInfo).match(/\{.*\}/s);
                    if (jsonMatch) {
                        certInfo = JSON.parse(jsonMatch[0]);
                    } else {
                        certInfo = { raw: rawCertInfo };
                    }
                } catch (e) {
                    console.warn(`[${name}] 권리증정보 파싱 실패:`, e.message);
                    certInfo = { raw: rawCertInfo };
                }
            }
            
            const { data: certData, error: certErr } = await supabase.from('certificate_registry').insert({
                entity_id: targetId,
                certificate_number_normalized: String(certNumber).trim(),
                certificate_number_raw: String(certNumber).trim(),
                certificate_status: certStatus,
                category: category,
                is_active: true,
                is_confirmed_for_count: certStatus === 'confirmed',
                source_type: 'member_number',
                note: JSON.stringify(certInfo)
            }).select();

            if (certErr) {
                console.error(`[${name}] 권리증 삽입 실패:`, certErr.message);
            } else {
                console.log(`[${name}] 권리증 삽입 성공: ${certNumber}`);
                results.certInserted++;
            }
        }

        // 6. 역할 등록
        if (category === '등기조합원') {
            await supabase.from('membership_roles').upsert({
                entity_id: targetId,
                role_code: '등기조합원',
                is_registered: true,
                role_status: isExit ? 'inactive' : 'active'
            }, { onConflict: 'entity_id,role_code' });
        }
    }

    console.log('\n--- 마이그레이션 결과 ---');
    console.log(JSON.stringify(results, null, 2));
    console.log('--- 마이그레이션 종료 ---');
}

migrate().catch(console.error);
