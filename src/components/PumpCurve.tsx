'use client';

import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OperatingPoint {
  flow: number;
  head: number;
}

interface TooltipPayload {
  name: string;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: number;
  polynomialDegree: number;
}

// 계수를 다항식 문자열로 변환하는 함수
function coefficientsToEquation(coefficients: number[]): string {
  if (coefficients.length === 0) return '';

  return coefficients.map((coef, i) => {
    if (Math.abs(coef) < 0.0001) return ''; // 매우 작은 계수는 무시

    const value = coef.toFixed(4);
    if (i === 0) return value;
    if (i === 1) return `${value}x`;
    return `${value}x^${i}`;
  }).filter(term => term !== '')
    .map((term, i) => {
      if (i === 0) return term;
      return term.startsWith('-') ? term : `+${term}`;
    }).join(' ') + '  [m]';
}

// 다항식 계수 계산 함수 (최소제곱법)
function polyfit(points: OperatingPoint[], degree: number): number[] {
  const n = points.length;
  if (n < degree + 1) return [];

  // 행렬 A와 벡터 b 생성
  const A: number[][] = [];
  const b: number[] = [];
  
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j <= degree; j++) {
      row.push(Math.pow(points[i].flow, j));
    }
    A.push(row);
    b.push(points[i].head);
  }

  // 정규 방정식 풀이 (A^T * A * x = A^T * b)
  const AT = A[0].map((_, i) => A.map(row => row[i]));
  const ATA = AT.map(row => {
    return A[0].map((_, j) => {
      return row.reduce((sum, _, k) => sum + row[k] * A[k][j], 0);
    });
  });
  const ATb = AT.map(row => {
    return row.reduce((sum, _, i) => sum + row[i] * b[i], 0);
  });

  // 가우스 소거법으로 연립방정식 풀이
  const n2 = degree + 1;
  for (let i = 0; i < n2; i++) {
    let maxEl = Math.abs(ATA[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n2; k++) {
      if (Math.abs(ATA[k][i]) > maxEl) {
        maxEl = Math.abs(ATA[k][i]);
        maxRow = k;
      }
    }

    for (let k = i; k < n2; k++) {
      const tmp = ATA[maxRow][k];
      ATA[maxRow][k] = ATA[i][k];
      ATA[i][k] = tmp;
    }
    const tmp = ATb[maxRow];
    ATb[maxRow] = ATb[i];
    ATb[i] = tmp;

    for (let k = i + 1; k < n2; k++) {
      const c = -ATA[k][i] / ATA[i][i];
      for (let j = i; j < n2; j++) {
        if (i === j) {
          ATA[k][j] = 0;
        } else {
          ATA[k][j] += c * ATA[i][j];
        }
      }
      ATb[k] += c * ATb[i];
    }
  }

  const coefficients = new Array(n2).fill(0);
  for (let i = n2 - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n2; j++) {
      sum += ATA[i][j] * coefficients[j];
    }
    coefficients[i] = (ATb[i] - sum) / ATA[i][i];
  }

  return coefficients;
}

// 상사법칙을 적용하여 새로운 속도에서의 운전점 계산
function applyAffinityLaws(point: OperatingPoint, speedRatio: number): OperatingPoint {
  return {
    flow: point.flow * speedRatio,
    head: point.head * (speedRatio * speedRatio)
  };
}

// 커스텀 툴팁 스타일 컴포넌트
const CustomTooltip = ({ active, payload, label, polynomialDegree }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    // 메인 커브(100% 속도)의 데이터만 찾기
    const mainCurveData = payload.find(p => p.name === `${polynomialDegree}차 추세선 (100%)`);
    if (!mainCurveData) return null;

    return (
      <div className="bg-white/80 backdrop-blur-sm px-2 py-1 rounded-sm border border-gray-200 shadow-sm text-xs">
        <p>유량: {label?.toFixed(1)} m³/h</p>
        <p>양정: {mainCurveData.value.toFixed(1)} m</p>
      </div>
    );
  }
  return null;
};

export default function PumpCurve() {
  const [operatingPoints, setOperatingPoints] = useState<OperatingPoint[]>([]);
  const [newPoint, setNewPoint] = useState<OperatingPoint>({ flow: 0, head: 0 });
  const [isExpanded, setIsExpanded] = useState(false);
  const [polynomialDegree, setPolynomialDegree] = useState<number>(2);
  const [vfdSpeed, setVfdSpeed] = useState<number>(100); // VFD 속도 (%)
  const [showSpeedCurves, setShowSpeedCurves] = useState<boolean>(true);

  // 예시 운전점 데이터
  const samplePoints: OperatingPoint[] = [
    { flow: 0, head: 50 },
    { flow: 100, head: 48 },
    { flow: 200, head: 42 },
    { flow: 300, head: 32 }
  ];

  const addPoint = (e: React.FormEvent) => {
    e.preventDefault();
    setOperatingPoints([...operatingPoints, newPoint].sort((a, b) => a.flow - b.flow));
    setNewPoint({ flow: 0, head: 0 });
    toast.success("운전점이 추가되었습니다.");
  };

  const loadSamplePoints = () => {
    setOperatingPoints(samplePoints);
    toast.success("예시 운전점이 로드되었습니다.");
  };

  const deletePoint = (index: number) => {
    const newPoints = [...operatingPoints];
    newPoints.splice(index, 1);
    setOperatingPoints(newPoints);
    toast.success("운전점이 삭제되었습니다.");
  };

  // 보간된 데이터 포인트와 추세선 생성
  const { interpolatedPoints, trendlinePoints, equation, speedCurves } = useMemo(() => {
    if (operatingPoints.length < 2) {
      return { 
        interpolatedPoints: operatingPoints, 
        trendlinePoints: [], 
        equation: '',
        speedCurves: []
      };
    }

    // 보간된 포인트 계산
    const interpolated: OperatingPoint[] = [];
    for (let i = 0; i < operatingPoints.length - 1; i++) {
      const current = operatingPoints[i];
      const next = operatingPoints[i + 1];
      const steps = 10;

      for (let j = 0; j <= steps; j++) {
        const ratio = j / steps;
        const flow = current.flow + (next.flow - current.flow) * ratio;
        const head = current.head + (next.head - current.head) * ratio;
        interpolated.push({ flow, head });
      }
    }

    // 추세선 계산
    const coefficients = polyfit(operatingPoints, polynomialDegree);
    const trendline: OperatingPoint[] = [];
    
    if (coefficients.length > 0 && operatingPoints.length > 0) {
      const minFlow = Math.min(...operatingPoints.map(p => p.flow));
      const maxFlow = Math.max(...operatingPoints.map(p => p.flow));
      const steps = 100;
      
      for (let i = 0; i <= steps; i++) {
        const flow = minFlow + (maxFlow - minFlow) * (i / steps);
        let head = 0;
        for (let j = 0; j < coefficients.length; j++) {
          head += coefficients[j] * Math.pow(flow, j);
        }
        trendline.push({ flow, head });
      }
    }

    // VFD 속도별 곡선 계산
    const speeds = [0.8, 0.6, 0.4]; // 80%, 60%, 40% 속도
    const speedCurves = speeds.map(speedRatio => ({
      speed: speedRatio * 100,
      points: trendline.map(point => applyAffinityLaws(point, speedRatio))
    }));

    const equation = coefficientsToEquation(coefficients);

    return { 
      interpolatedPoints: interpolated, 
      trendlinePoints: trendline, 
      equation,
      speedCurves
    };
  }, [operatingPoints, polynomialDegree]);

  return (
    <Card className="w-full max-w-md mx-auto">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="text-lg">Pump Performance Curve</CardTitle>
        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </div>
      {isExpanded && (
        <>
          <CardHeader className="px-4 pt-0 text-center">
            <CardDescription>
              Calculate pump performance curve from operating points
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4">
            <div className="flex justify-end mb-2">
              <Button
                type="button"
                variant="outline"
                onClick={loadSamplePoints}
                className="text-sm"
              >
                Default 값 불러오기
              </Button>
            </div>

            <form onSubmit={addPoint} className="mb-4 flex gap-4">
              <div>
                <label htmlFor="flow" className="block text-sm font-medium text-gray-700">유량 (m³/h)</label>
                <input
                  id="flow"
                  type="number"
                  value={newPoint.flow}
                  onChange={(e) => setNewPoint({ ...newPoint, flow: parseFloat(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                  aria-label="유량 입력"
                  title="유량 입력"
                  placeholder="유량을 입력하세요"
                />
              </div>
              <div>
                <label htmlFor="head" className="block text-sm font-medium text-gray-700">양정 (m)</label>
                <input
                  id="head"
                  type="number"
                  value={newPoint.head}
                  onChange={(e) => setNewPoint({ ...newPoint, head: parseFloat(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                  aria-label="양정 입력"
                  title="양정 입력"
                  placeholder="양정을 입력하세요"
                />
              </div>
              <Button
                type="submit"
                className="mt-6 px-4 py-2 bg-gray-600 hover:bg-gray-800 text-white"
              >
                포인트 추가
              </Button>
            </form>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">다항식 차수:</label>
                <Select
                  value={polynomialDegree.toString()}
                  onValueChange={(value) => setPolynomialDegree(parseInt(value))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="차수 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1차 (선형)</SelectItem>
                    <SelectItem value="2">2차 (포물선)</SelectItem>
                    <SelectItem value="3">3차</SelectItem>
                    <SelectItem value="4">4차</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">VFD 속도 곡선:</label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSpeedCurves(!showSpeedCurves)}
                    className={showSpeedCurves ? "bg-blue-50" : ""}
                  >
                    {showSpeedCurves ? "숨기기" : "보이기"}
                  </Button>
                </div>
              </div>
            </div>

            {equation && (
              <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded-md">
                추세선 방정식: H = {equation}
              </div>
            )}

            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="flow"
                    label={{ value: '유량 (m³/h)', position: 'bottom', style: { fontSize: '10px' } }}
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    label={{ value: '양정 (m)', angle: -90, position: 'left', style: { fontSize: '10px' } }}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip 
                    content={<CustomTooltip polynomialDegree={polynomialDegree} />}
                    cursor={{ stroke: '#666', strokeWidth: 1, strokeDasharray: '5 5' }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36}
                    wrapperStyle={{ fontSize: '10px' }}
                  />
                  {showSpeedCurves && speedCurves.map((curve, index) => (
                    <Line
                      key={curve.speed}
                      data={curve.points}
                      type="monotone"
                      dataKey="head"
                      name={`${curve.speed}% 속도`}
                      stroke={`#dc2626`}
                      strokeOpacity={0.3 + (0.2 * index)}
                      strokeWidth={1}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={false}
                    />
                  ))}
                  <Line
                    data={interpolatedPoints}
                    type="monotone"
                    dataKey="head"
                    name="보간 곡선"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    activeDot={false}
                  />
                  <Line
                    data={trendlinePoints}
                    type="monotone"
                    dataKey="head"
                    name={`${polynomialDegree}차 추세선 (100%)`}
                    stroke="#dc2626"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{ r: 4, stroke: '#dc2626', strokeWidth: 2, fill: '#fff' }}
                  />
                  <Line
                    data={operatingPoints}
                    type="monotone"
                    dataKey="head"
                    name="운전점"
                    stroke="#2563eb"
                    strokeWidth={0}
                    dot={{ stroke: '#2563eb', strokeWidth: 2, r: 4, fill: '#ffffff' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">입력된 운전점</h3>
              <div className="grid grid-cols-1 gap-2">
                {operatingPoints.map((point, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-100 rounded-md">
                    <span>유량: {point.flow} m³/h, 양정: {point.head} m</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deletePoint(index)}
                      className="h-8 w-8 hover:bg-red-100 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
} 