'use client';

import dynamic from 'next/dynamic';

const PumpCurveNew2 = dynamic(() => import('@/components/PumpCurveNew2'), {
  ssr: false
});

export default function PumpCurveNew2Page() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Pump Curve New 2</h1>
      <PumpCurveNew2 />
    </div>
  );
} 