'use client';

import React, { useEffect, useRef } from 'react';

export default function AsiaPayForm({ params }: { params: any }) {
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (formRef.current && params?.payGateUrl) {
            formRef.current.submit();
        }
    }, [params]);

    if (!params) return null;

    return (
        <form ref={formRef} action={params.payGateUrl} method="POST" className="hidden">
            {Object.entries(params).map(([key, value]) => {
                if (key !== 'payGateUrl' && value !== undefined) {
                    return <input key={key} type="hidden" name={key} value={String(value)} />;
                }
                return null;
            })}
        </form>
    );
}


