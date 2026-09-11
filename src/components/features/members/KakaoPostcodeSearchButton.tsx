'use client';

import Script from 'next/script';
import { useState } from 'react';
import { MaterialIcon } from '@/components/ui/icon';

const KAKAO_POSTCODE_SCRIPT_URL = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

type KakaoPostcodeResult = {
    zonecode: string;
    address: string;
    roadAddress: string;
    jibunAddress: string;
    userSelectedType: 'R' | 'J';
};

type KakaoPostcodeConstructor = new (options: {
    oncomplete: (data: KakaoPostcodeResult) => void;
}) => {
    open: (options?: {
        q?: string;
        popupKey?: string;
        popupTitle?: string;
    }) => void;
};

declare global {
    interface Window {
        kakao?: {
            Postcode?: KakaoPostcodeConstructor;
        };
    }
}

type Props = {
    initialQuery?: string | null;
    disabled?: boolean;
    className?: string;
    onSelect: (selection: { postalCode: string; address: string }) => void;
};

function selectAddress(data: KakaoPostcodeResult) {
    const selectedAddress = data.userSelectedType === 'R'
        ? data.roadAddress
        : data.jibunAddress;

    return {
        postalCode: data.zonecode.trim(),
        address: (selectedAddress || data.address).trim(),
    };
}

export function KakaoPostcodeSearchButton({ initialQuery, disabled = false, className = '', onSelect }: Props) {
    const [ready, setReady] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);

    const openPostcodeSearch = () => {
        const Postcode = window.kakao?.Postcode;
        if (!Postcode) {
            setLoadFailed(true);
            return;
        }

        const postcode = new Postcode({
            oncomplete: (data) => {
                const selection = selectAddress(data);
                if (!selection.postalCode || !selection.address) return;
                onSelect(selection);
            },
        });

        const query = initialQuery?.trim();
        postcode.open({
            ...(query ? { q: query } : {}),
            popupKey: 'peopleon-postcode-search',
            popupTitle: 'PeopleON 주소 검색',
        });
    };

    return (
        <>
            <Script
                id="kakao-postcode-service"
                src={KAKAO_POSTCODE_SCRIPT_URL}
                strategy="afterInteractive"
                onReady={() => {
                    setReady(Boolean(window.kakao?.Postcode));
                    setLoadFailed(false);
                }}
                onError={() => {
                    setReady(false);
                    setLoadFailed(true);
                }}
            />
            <button
                type="button"
                onClick={openPostcodeSearch}
                disabled={disabled || !ready}
                className={`inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-md border border-cyan-400/25 bg-cyan-500/10 px-2.5 text-xs font-black text-cyan-200 transition-colors hover:border-cyan-300/40 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
                aria-label="주소 검색으로 우편번호 찾기"
            >
                <MaterialIcon name="search" size="xs" />
                {loadFailed ? '불러오기 실패' : '주소 검색'}
            </button>
        </>
    );
}
