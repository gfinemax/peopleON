# 반복 조회 브라우저 재현 결과

2026-09-05, Chrome, React 19 production mode, 조회 응답 지연 30ms, 각 1.5초. 실제 DB가 아닌 빈 배열 mock 응답.

- 원본: Git 9f488aa의 MemberWorkspacePage.tsx/useWorkspaceData 함수를 AST로 추출
- 수정본: 작업 중 동일 함수와 실제 useStableIds/readAllPages를 번들링
- 부모는 실제 MemberWorkspaceSummary처럼 매 렌더마다 ['fixture-id']를 생성
- 각 데이터 요청이 실제 로컬 HTTP fetch를 한 번 보낼 때 카운터 증가
- 결과: before 58, after 2, 요청 감소 96.5517%
- 실측 Supabase egress byte 비교가 아니며 실제 월간 절감률로 대체할 수 없음
- Strict Mode를 끈 production React에서도 재현됨

## 재현 소스

아래 소스를 저장하고 저장소 루트 기준 import 경로를 맞춘 다음 esbuild@0.25.12로 번들링한다. /mock/*는 30ms 뒤 {data:[],error:null} JSON을 반환하게 한다. 이 코드는 운영 빌드에 포함하지 않는다.

```tsx
import React, {useState,useEffect} from 'react';import {createRoot} from 'react-dom/client';import {useStableIds} from '../../src/lib/hooks/useStableIds';import {readAllPages} from '../../src/lib/supabase/readAllPages';
let mode='before';const requests={before:0,after:0};function createClient(){return {from(table){let runMode=mode; const q={select(){return q},in(){return q},order(){return q},limit(){return q},range(){return q},then(resolve,reject){requests[runMode]++;return fetch('/mock/'+runMode+'/'+table).then(r=>r.json()).then(resolve,reject)}};return q;}};}
function useBefore(memberIds: string[]): WorkspaceData & { loading: boolean } {
    const [data, setData] = useState<WorkspaceData>({ payments: [], logs: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            const supabase = createClient();
            const [payments, logs] = await Promise.all([
                supabase.from('member_payments').select('*').in('entity_id', memberIds).order('sort_order'),
                supabase.from('interaction_logs').select('id,type,summary,staff_name,attachment,created_at').in('entity_id', memberIds).order('created_at', { ascending: false }).limit(30),
            ]);
            if (!cancelled) {
                setData({ payments: (payments.data || []) as PaymentRecord[], logs: (logs.data || []) as LogRow[] });
                setLoading(false);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [memberIds]);

    return { ...data, loading };
}
function useAfter(inputMemberIds: string[]): WorkspaceData & { loading: boolean } {
    const memberIds = useStableIds(inputMemberIds);
    const [data, setData] = useState<WorkspaceData>({ payments: [], logs: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            const supabase = createClient();
            const [payments, logs] = await Promise.all([
                readAllPages(supabase.from('member_payments').select('id, entity_id, unit_type_id, payment_type, amount_due, amount_paid, deposit_account_id, paid_date, receipt_note, is_contribution, status, sort_order').in('entity_id', memberIds).order('sort_order').order('id', { ascending: true })),
                supabase.from('interaction_logs').select('id,type,summary,staff_name,attachment,created_at').in('entity_id', memberIds).order('created_at', { ascending: false }).limit(30).order('id', { ascending: true }),
            ]);
            if (!cancelled) {
                setData({ payments: (payments.data || []) as PaymentRecord[], logs: (logs.data || []) as LogRow[] });
                setLoading(false);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [memberIds]);

    return { ...data, loading };
}
function Before(){useBefore(['fixture-id']);return <p>수정 전 측정 중</p>};function After(){useAfter(['fixture-id']);return <p>수정 후 측정 중</p>};function App(){const [phase,setPhase]=useState(0);useEffect(()=>{const a=setTimeout(()=>setPhase(1),1500),b=setTimeout(()=>{mode='after';setPhase(2)},1800),c=setTimeout(()=>setPhase(3),3300);return()=>{clearTimeout(a);clearTimeout(b);clearTimeout(c)}},[]);return <main><h1>peopleOn Egress fixture</h1><p>실제 조회 훅 + 가짜 데이터; 각 1.5초 동안 관찰</p>{phase===0?<Before/>:phase===2?<After/>:null}{phase===3?<pre id="result">{JSON.stringify({requests,reduction:1-requests.after/requests.before})}</pre>:null}</main>};createRoot(document.getElementById('root')).render(<App/>);
```
