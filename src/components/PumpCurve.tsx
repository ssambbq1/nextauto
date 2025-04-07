'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Trash2, Copy, Download, FileJson } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

interface OperatingPoint {
  flow: number;
  head: number;
  efficiency?: number;
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

interface SpeedCurve {
  speed: number;
  points: OperatingPoint[];
}

interface ComparisonCase {
  caseName: string;
  operatingPoints: OperatingPoint[];
  equations: {
    head: {
      degree: number;
      equation: string;
    };
    efficiency: {
      degree: number;
      equation: string;
    };
  };
}

// 계수를 다항식 문자열로 변환하는 함수
function coefficientsToEquation(coefficients: number[]): string {
  if (coefficients.length === 0) return '';

  return coefficients.map((coef, i) => {
    if (Math.abs(coef) < 0.000000000001) return ''; // 매우 작은 계수는 무시

    const value = coef.toFixed(12);
    if (i === 0) return value;
    if (i === 1) return `${value}x`;
    return `${value}x^${i}`;
  }).filter(term => term !== '')
    .map((term, i) => {
      if (i === 0) return term;
      return term.startsWith('-') ? term : `+${term}`;
    }).join(' ');
}

// 계수를 다항식 문자열로 변환하는 함수 (효율 방정식용)
function coefficientsToEfficiencyEquation(coefficients: number[]): string {
  if (coefficients.length === 0) return '';

  return coefficients.map((coef, i) => {
    if (Math.abs(coef) < 0.000000000001) return ''; // 매우 작은 계수는 무시

    const value = coef.toFixed(12);
    if (i === 0) return value;
    if (i === 1) return `${value}x`;
    return `${value}x^${i}`;
  }).filter(term => term !== '')
    .map((term, i) => {
      if (i === 0) return term;
      return term.startsWith('-') ? term : `+${term}`;
    }).join(' ');
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
  const [comparisonCase, setComparisonCase] = useState<ComparisonCase | null>(null);
  const [showComparison, setShowComparison] = useState<boolean>(false);
  const [newPoint, setNewPoint] = useState<OperatingPoint>({ flow: 0, head: 0, efficiency: 0 });
  const [headPolynomialDegree, setHeadPolynomialDegree] = useState<number>(3);
  const [efficiencyPolynomialDegree, setEfficiencyPolynomialDegree] = useState<number>(3);
  const [editingCell, setEditingCell] = useState<{ index: number; field: keyof OperatingPoint } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [draggedPoint, setDraggedPoint] = useState<{ 
    index: number; 
    field: keyof OperatingPoint; 
    x: number;
    type: 'head' | 'efficiency';
  } | null>(null);
  const [isHovering, setIsHovering] = useState<number | null>(null);
  const [newPointIndex, setNewPointIndex] = useState<number | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [imageOpacity, setImageOpacity] = useState<number>(0.3);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [maxFlowInput, setMaxFlowInput] = useState<number>(400);  // x축 최대값
  const [maxHeadInput, setMaxHeadInput] = useState<number>(60);   // 양정 y축 최대값
  const [maxEfficiencyInput, setMaxEfficiencyInput] = useState<number>(100);   // 효율 y축 최대값
  const [minHeadInput] = useState<number>(0);   // 양정 y축 최소값 (고정)
  const [minEfficiencyInput] = useState<number>(0);   // 효율 y축 최소값 (고정)
  const [projectName, setProjectName] = useState<string>('');
  const [pumpName, setPumpName] = useState<string>('');
  const [maker, setMaker] = useState<string>('');
  const [contractPhase, setContractPhase] = useState<string>('견적');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const comparisonFileInputRef = useRef<HTMLInputElement>(null);

  // 예시 운전점 데이터
  const samplePoints: OperatingPoint[] = [
    { flow: 0, head: 50, efficiency: 0 },
    { flow: 100, head: 48, efficiency: 60 },
    { flow: 200, head: 42, efficiency: 85 },
    { flow: 300, head: 32, efficiency: 65 }
  ];

  const addPoint = (e: React.FormEvent) => {
    e.preventDefault();
    setOperatingPoints([...operatingPoints, newPoint].sort((a, b) => a.flow - b.flow));
    setNewPoint({ flow: 0, head: 0, efficiency: 0 });
  };

  const loadSamplePoints = () => {
    setOperatingPoints(samplePoints);
  };

  const deletePoint = (index: number) => {
    const newPoints = [...operatingPoints];
    newPoints.splice(index, 1);
    setOperatingPoints(newPoints);
  };

  const startEditing = (index: number, field: keyof OperatingPoint, value: number) => {
    setEditingCell({ index, field });
    setEditValue(value.toString());
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      finishEditing();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const finishEditing = () => {
    if (editingCell) {
      const { index, field } = editingCell;
      const value = parseFloat(editValue);
      
      if (!isNaN(value)) {
        const newPoints = [...operatingPoints];
        newPoints[index] = { ...newPoints[index], [field]: value };
        setOperatingPoints(newPoints.sort((a, b) => a.flow - b.flow));
      }
      
      setEditingCell(null);
    }
  };

  const handleMouseDown = (index: number, e: React.MouseEvent, cx: number, type: 'head' | 'efficiency') => {
    e.stopPropagation();
    setDraggedPoint({ index, field: type, x: cx, type });
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleDragEnd);
  };

  const handleMouseEnter = (index: number) => {
    setIsHovering(index);
  };

  const handleMouseLeave = () => {
    setIsHovering(null);
  };

  const handleDrag = (e: MouseEvent) => {
    if (!draggedPoint) return;

    const { index, x, type } = draggedPoint;
    const newPoints = [...operatingPoints];

    // Get SVG element and its dimensions
    const svgElement = document.querySelector('.recharts-wrapper svg');
    if (!svgElement) return;

    const svgRect = svgElement.getBoundingClientRect();
    const chartHeight = svgRect.height - 40; // Adjust for margins

    // Calculate relative position within the chart (only Y)
    const relativeY = e.clientY - svgRect.top;

    // Convert position to value based on type
    if (type === 'head') {
      const headRange = maxHeadInput;
      const newHead = Math.max(0, Math.min(maxHeadInput, ((chartHeight - relativeY) / chartHeight) * headRange));
      newPoints[index] = {
        ...newPoints[index],
        head: Number(newHead.toFixed(1))
      };
    } else {
      // For efficiency, range is 0-100
      const newEfficiency = Math.max(0, Math.min(100, ((chartHeight - relativeY) / chartHeight) * 100));
      newPoints[index] = {
        ...newPoints[index],
        efficiency: Number(newEfficiency.toFixed(1))
      };
    }

    setOperatingPoints(newPoints);
  };

  const handleDragEnd = () => {
    if (draggedPoint) {
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', handleDragEnd);
      // Sort points after drag ends
      setOperatingPoints(prev => [...prev].sort((a, b) => a.flow - b.flow));
      setDraggedPoint(null);
    }
  };

  // 보간된 데이터 포인트와 추세선 생성
  const { trendlinePoints, headEquation, efficiencyEquation, maxOperatingFlow } = useMemo<{
    trendlinePoints: OperatingPoint[];
    headEquation: string;
    efficiencyEquation: string;
    maxOperatingFlow: number;
  }>(() => {
    if (operatingPoints.length < 1) {
      return { 
        trendlinePoints: [], 
        headEquation: '',
        efficiencyEquation: '',
        maxOperatingFlow: 0
      };
    }

    // 최대 유량점 계산
    const maxOperatingFlow = Math.max(...operatingPoints.map(p => p.flow));

    // 양정 추세선 계산
    const headCoefficients = polyfit(
      operatingPoints.length === 1 
        ? [...operatingPoints, { flow: 0, head: operatingPoints[0].head }] 
        : operatingPoints, 
      headPolynomialDegree
    );
    const trendline: OperatingPoint[] = [];
    
    // 효율 추세선 계산
    const efficiencyPoints = operatingPoints.filter(p => p.efficiency !== undefined);
    const efficiencyCoefficients = polyfit(
      efficiencyPoints.length === 1
        ? [...efficiencyPoints, { flow: 0, head: efficiencyPoints[0].efficiency || 0 }]
        : efficiencyPoints.map(p => ({ flow: p.flow, head: p.efficiency || 0 })),
      efficiencyPolynomialDegree
    );

    // 추세선 계산 로직 수정
    if (operatingPoints.length > 0) {
      const steps = 100;
      const minFlow = 0;
      const trendlineMaxFlow = maxOperatingFlow * 1.05; // 최대 유량의 105%까지만 표시
      
      for (let i = 0; i <= steps; i++) {
        const flow = minFlow + (trendlineMaxFlow - minFlow) * (i / steps);
        let head = 0;
        let efficiency = 0;
        
        // Calculate head
        if (headCoefficients.length > 0) {
          for (let j = 0; j < headCoefficients.length; j++) {
            head += headCoefficients[j] * Math.pow(flow, j);
          }
        }
        
        // Calculate efficiency
        if (efficiencyCoefficients.length > 0) {
          for (let j = 0; j < efficiencyCoefficients.length; j++) {
            efficiency += efficiencyCoefficients[j] * Math.pow(flow, j);
          }
        }
        
        trendline.push({ flow, head, efficiency });
      }
    }

    // 양정 방정식 생성
    const headEquation = coefficientsToEquation(headCoefficients);

    // 효율 방정식 생성
    const efficiencyEquation = coefficientsToEfficiencyEquation(efficiencyCoefficients);

    return { 
      trendlinePoints: trendline, 
      headEquation,
      efficiencyEquation,
      maxOperatingFlow
    };
  }, [operatingPoints, headPolynomialDegree, efficiencyPolynomialDegree]);

  const copyTableToClipboard = () => {
    // 헤더 행
    const headers = ['No.', '유량 (m³/h)', '양정 (m)', '효율 (%)'];
    
    // 데이터 행
    const rows = operatingPoints.map((point, index) => [
      index + 1,
      point.flow,
      point.head,
      point.efficiency || ''
    ]);
    
    // 헤더와 데이터를 결합하여 탭으로 구분된 문자열 생성
    const tableText = [
      headers.join('\t'),
      ...rows.map(row => row.join('\t'))
    ].join('\n');
    
    // 클립보드에 복사
    navigator.clipboard.writeText(tableText);
    toast.success("운전점 데이터가 복사되었습니다.");
  };

  const exportToExcel = () => {
    // 데이터 준비
    const headers = ['No.', '유량 (m³/h)', '양정 (m)', '효율 (%)'];
    const data = operatingPoints.map((point, index) => [
      index + 1,
      point.flow,
      point.head,
      point.efficiency || ''
    ]);

    // 워크북 생성
    const wb = XLSX.utils.book_new();
    
    // 데이터를 워크시트로 변환
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // 열 너비 설정
    const colWidths = [
      { wch: 5 },  // No.
      { wch: 12 }, // 유량
      { wch: 10 }, // 양정
      { wch: 10 }  // 효율
    ];
    ws['!cols'] = colWidths;

    // 워크시트를 워크북에 추가
    XLSX.utils.book_append_sheet(wb, ws, '운전점 데이터');

    // 파일 저장
    XLSX.writeFile(wb, '운전점_데이터.xlsx');
  };

  const exportToJson = async () => {
    const caseData = {
      caseName: caseName,
      operatingPoints: operatingPoints,
      maxValues: {
        head: maxHeadInput,
        efficiency: maxEfficiencyInput
      },
      equations: {
        head: {
          degree: headPolynomialDegree,
          equation: headEquation
        },
        efficiency: {
          degree: efficiencyPolynomialDegree,
          equation: efficiencyEquation
        }
      }
    };

    try {
      const response = await fetch('/api/saveCurveData', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(caseData),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message || '케이스가 성공적으로 저장되었습니다.');
      } else {
        toast.error(result.message || 'JSON 파일 저장 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('JSON 파일 저장 중 오류:', error);
      toast.error('JSON 파일 저장 중 오류가 발생했습니다.');
    }
  };

  // 이미지 크기와 위치를 계산하는 함수
  const calculateImagePosition = (imageUrl: string) => {
    const img = new Image();
    img.onload = () => {
      const chartContainer = document.querySelector('.recharts-wrapper');
      const chartArea = document.querySelector('.recharts-cartesian-grid');
      const yAxis = document.querySelector('.recharts-yAxis.yAxis');
      if (!chartContainer || !chartArea || !yAxis) return;

      const containerRect = chartContainer.getBoundingClientRect();
      const chartAreaRect = chartArea.getBoundingClientRect();
      const yAxisRect = yAxis.getBoundingClientRect();

      // 차트 영역의 실제 크기와 위치 계산
      const chartWidth = chartAreaRect.width;
      const chartHeight = chartAreaRect.height;

      // y축의 0점과 최대값 위치 계산
      const yAxisZeroPoint = chartAreaRect.bottom - containerRect.top;
      const yAxisMaxPoint = chartAreaRect.top - containerRect.top;
      const actualChartHeight = yAxisZeroPoint - yAxisMaxPoint;

      // x축의 시작점과 끝점 계산
      const xAxisStart = chartAreaRect.left - containerRect.left;
      const xAxisEnd = chartAreaRect.right - containerRect.left;
      const actualChartWidth = xAxisEnd - xAxisStart;

      // y축 방향으로 7% 아래로 이동
      const yOffset = actualChartHeight * 0.07;

      setImagePosition({
        x: xAxisStart,
        y: yAxisMaxPoint + yOffset, // 7% 아래로 이동
        width: actualChartWidth,
        height: actualChartHeight
      });
    };
    img.src = imageUrl;
  };

  // 클립보드 붙여넣기 이벤트 핸들러
  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const imageUrl = reader.result as string;
            setBackgroundImage(imageUrl);
            calculateImagePosition(imageUrl);
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    }
  };

  // 컴포넌트 마운트 시 이벤트 리스너 등록
  React.useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, []);

  // 차트 크기가 변경될 때 이미지 위치 재계산
  React.useEffect(() => {
    if (backgroundImage) {
      // 차트가 완전히 렌더링된 후에 위치 계산
      setTimeout(() => calculateImagePosition(backgroundImage), 500);
    }
  }, [backgroundImage, maxFlowInput, maxHeadInput, operatingPoints]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target?.result as string);
        
        // 데이터 유효성 검사
        if (!jsonData.caseName || !jsonData.operatingPoints || !jsonData.equations) {
          toast.error('올바르지 않은 JSON 파일 형식입니다.');
          return;
        }

        // 데이터 로드
        setCaseName(jsonData.caseName);
        setOperatingPoints(jsonData.operatingPoints);
        
        // 최대값 설정
        if (jsonData.maxValues) {
          setMaxHeadInput(jsonData.maxValues.head);
          setMaxEfficiencyInput(jsonData.maxValues.efficiency);
        }

        // 다항식 차수 설정
        if (jsonData.equations.head?.degree) {
          setHeadPolynomialDegree(jsonData.equations.head.degree);
        }
        if (jsonData.equations.efficiency?.degree) {
          setEfficiencyPolynomialDegree(jsonData.equations.efficiency.degree);
        }

        toast.success('케이스를 성공적으로 불러왔습니다.');
      } catch (error) {
        toast.error('JSON 파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
    
    // 파일 입력 초기화 (같은 파일을 다시 선택할 수 있도록)
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const loadComparisonCase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target?.result as string);
        
        // 데이터 유효성 검사
        if (!jsonData.caseName || !jsonData.operatingPoints || !jsonData.equations) {
          toast.error('올바르지 않은 JSON 파일 형식입니다.');
          return;
        }

        setComparisonCase(jsonData);
        setShowComparison(true);
        toast.success('비교 케이스를 성공적으로 불러왔습니다.');
      } catch (error) {
        toast.error('JSON 파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
    
    if (comparisonFileInputRef.current) {
      comparisonFileInputRef.current.value = '';
    }
  };

  // Case 명 자동 생성 함수
  const generateCaseName = (date: Date = new Date()) => {
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
    return `${projectName || 'PJT'}_${contractPhase}_${pumpName || 'PUMP'}_${maker || 'MAKER'}_${dateStr}`;
  };

  // Case 명 상태 초기화 및 업데이트
  const [caseName, setCaseName] = useState<string>(() => generateCaseName());

  // 프로젝트 정보가 변경될 때마다 Case 명 업데이트
  useEffect(() => {
    setCaseName(generateCaseName());
  }, [projectName, pumpName, maker, contractPhase]);

  return (
    <Card className="relative">
      <style jsx global>
        {`
          @keyframes blink {
            0% { 
              fill: #ffffff;
              r: 4;
            }
            50% { 
              fill: #fef08a;
              r: 4;
            }
            100% { 
              fill: #ffffff;
              r: 4;
            }
          }
          @keyframes blinkOuter {
            0% { 
              fill: transparent;
              r: 8;
              stroke-width: 0;
            }
            50% { 
              fill: #fef08a;
              r: 12;
              stroke-width: 2;
            }
            100% { 
              fill: transparent;
              r: 8;
              stroke-width: 0;
            }
          }
          @keyframes blinkNewPoint {
            0%, 100% { 
              fill: transparent;
              r: 8;
              stroke-width: 0;
              opacity: 0;
            }
            16.67%, 50% { 
              fill: #fef08a;
              r: 16;
              stroke-width: 2;
              opacity: 0.3;
            }
            33.33%, 66.67% {
              fill: transparent;
              r: 8;
              stroke-width: 0;
              opacity: 0;
            }
          }
          .blinking {
            animation: blink 0.8s ease-in-out infinite;
          }
          .blinking-outer {
            animation: blinkOuter 0.8s ease-in-out infinite;
          }
          .blinking-new {
            animation: blinkNewPoint 2.4s ease-in-out 1;
          }
          .vertical-arrow {
            marker-end: url(#arrowhead);
            marker-start: url(#arrowhead-up);
          }
        `}
      </style>
      <div className="p-4">
        <CardTitle className="text-lg mb-4">Pump Performance Curve</CardTitle>
        <CardDescription className="text-center mb-6">
              Calculate pump performance curve from operating points
            </CardDescription>
        <CardContent className="space-y-4 px-2 sm:px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 w-24">PJT 명:</label>
                <Input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="flex-1"
                  placeholder="프로젝트명 입력"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 w-24">Pump 명:</label>
                <Input
                  type="text"
                  value={pumpName}
                  onChange={(e) => setPumpName(e.target.value)}
                  className="flex-1"
                  placeholder="펌프명 입력"
                />
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 w-24">Maker:</label>
                <Input
                  type="text"
                  value={maker}
                  onChange={(e) => setMaker(e.target.value)}
                  className="flex-1"
                  placeholder="제조사 입력"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">계약단계:</label>
                <select
                  value={contractPhase}
                  onChange={(e) => setContractPhase(e.target.value)}
                  className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  title="계약단계 선택"
                  aria-label="계약단계 선택"
                >
                  <option value="견적">견적</option>
                  <option value="수행">수행</option>
                  <option value="기타">기타</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Case 명:</label>
                <Input
                  type="text"
                  value={caseName}
                  onChange={(e) => setCaseName(e.target.value)}
                  className="w-[500px]"
                  placeholder="Case 명이 자동으로 생성됩니다"
                />
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".json"
                className="hidden"
                title="JSON 파일 업로드"
                aria-label="JSON 파일 업로드"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1"
              >
                <FileJson className="h-4 w-4" />
                <span>Load JSON</span>
              </Button>
              <input
                type="file"
                ref={comparisonFileInputRef}
                onChange={loadComparisonCase}
                accept=".json"
                className="hidden"
                title="비교 케이스 JSON 파일 업로드"
                aria-label="비교 케이스 JSON 파일 업로드"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => comparisonFileInputRef.current?.click()}
                className="flex items-center gap-1"
              >
                <FileJson className="h-4 w-4" />
                <span>Load Comparison</span>
              </Button>
              {comparisonCase && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setComparisonCase(null);
                    setShowComparison(false);
                  }}
                  className="flex items-center gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Remove Comparison</span>
                </Button>
              )}
            </div>
              <Button
                type="button"
                variant="outline"
                onClick={loadSamplePoints}
                className="text-sm"
              >
                Default 값 불러오기
              </Button>
            </div>

          <form onSubmit={addPoint} className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="flow" className="text-sm sm:text-base">유량 (m³/h)</Label>
              <Input
                  id="flow"
                  type="number"
                  value={newPoint.flow}
                  onChange={(e) => setNewPoint({ ...newPoint, flow: parseFloat(e.target.value) })}
                className="text-sm sm:text-base"
                  required
                  placeholder="유량을 입력하세요"
                />
              </div>
            <div className="space-y-2">
              <Label htmlFor="head" className="text-sm sm:text-base">양정 (m)</Label>
              <Input
                  id="head"
                  type="number"
                  value={newPoint.head}
                  onChange={(e) => setNewPoint({ ...newPoint, head: parseFloat(e.target.value) })}
                className="text-sm sm:text-base"
                  required
                  placeholder="양정을 입력하세요"
                />
              </div>
            <div className="space-y-2">
              <Label htmlFor="efficiency" className="text-sm sm:text-base">효율 (%)</Label>
              <Input
                id="efficiency"
                type="number"
                value={newPoint.efficiency}
                onChange={(e) => setNewPoint({ ...newPoint, efficiency: parseFloat(e.target.value) })}
                className="text-sm sm:text-base"
                placeholder="효율을 입력하세요"
                min="0"
                max="100"
              />
            </div>
            <div className="space-y-2 flex items-end">
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                운전점 추가
              </Button>
            </div>
            </form>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">양정 다항식 차수:</label>
              <Input
                type="number"
                value={headPolynomialDegree}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (value >= 1 && value <= 4) {
                    setHeadPolynomialDegree(value);
                  }
                }}
                min={1}
                max={4}
                className="w-20 text-center"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">효율 다항식 차수:</label>
              <Input
                type="number"
                value={efficiencyPolynomialDegree}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (value >= 1 && value <= 4) {
                    setEfficiencyPolynomialDegree(value);
                  }
                }}
                min={1}
                max={4}
                className="w-20 text-center"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">x축 최대값:</label>
              <Input
                type="number"
                value={maxFlowInput}
                onChange={(e) => {
                  const newValue = parseInt(e.target.value);
                  if (newValue > 0) {
                    setMaxFlowInput(newValue);
                  }
                }}
                min={1}
                className="w-24 text-center"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">y축 최대값(양정):</label>
              <Input
                type="number"
                value={maxHeadInput}
                onChange={(e) => {
                  const newValue = parseInt(e.target.value);
                  if (newValue > 0) {
                    setMaxHeadInput(newValue);
                  }
                }}
                min={1}
                className="w-24 text-center"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">y축 최대값(효율):</label>
              <Input
                type="number"
                value={maxEfficiencyInput}
                onChange={(e) => {
                  const newValue = parseInt(e.target.value);
                  if (newValue > 0 && newValue <= 100) {
                    setMaxEfficiencyInput(newValue);
                  }
                }}
                min={1}
                max={100}
                className="w-24 text-center"
              />
            </div>
              </div>

          {headEquation && (
              <div className="space-y-2">
              <div className="flex items-center justify-between rounded-md bg-gray-50 p-2">
                <div className="text-sm text-gray-600">
                  양정 방정식 ({headPolynomialDegree}차): H = {headEquation}
                </div>
                  <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-gray-200 active:bg-gray-300 transition-colors"
                  onClick={() => {
                    navigator.clipboard.writeText(`H = ${headEquation}`);
                    toast.success("양정 방정식이 복사되었습니다.");
                  }}
                >
                  <Copy className="h-4 w-4" />
                  </Button>
                </div>
              {efficiencyEquation && (
                <div className="flex items-center justify-between rounded-md bg-gray-50 p-2">
                  <div className="text-sm text-gray-600">
                    효율 방정식 ({efficiencyPolynomialDegree}차): η = {efficiencyEquation}
              </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-gray-200 active:bg-gray-300 transition-colors"
                    onClick={() => {
                      navigator.clipboard.writeText(`η = ${efficiencyEquation}`);
                      toast.success("효율 방정식이 복사되었습니다.");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
            </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {/* Background Image Controls */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">배경 이미지:</label>
                <span className="text-sm text-gray-500">(Ctrl + V로 이미지 붙여넣기)</span>
              </div>
              {backgroundImage && (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">투명도:</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={imageOpacity}
                      onChange={(e) => setImageOpacity(parseFloat(e.target.value))}
                      className="w-24"
                      title="이미지 투명도 조절"
                      aria-label="이미지 투명도 조절"
                    />
                  </div>
                <Button
                  variant="outline"
                  size="sm"
                    onClick={() => setBackgroundImage(null)}
                    className="text-sm"
                >
                    이미지 제거
                </Button>
                </>
              )}
          </div>

            {/* Combined Performance and Efficiency Curve */}
            <div className="h-[400px] sm:h-[500px] relative">
              {backgroundImage && (
                <div 
                  className="absolute z-0"
                  style={{
                    left: `${imagePosition.x}px`,
                    top: `${imagePosition.y}px`,
                    width: `${imagePosition.width}px`,
                    height: `${imagePosition.height}px`,
                    backgroundImage: `url(${backgroundImage})`,
                    backgroundSize: '100% 100%',
                    backgroundPosition: 'left bottom',
                    backgroundRepeat: 'no-repeat',
                    opacity: imageOpacity,
                    pointerEvents: 'none',
                    transformOrigin: 'left bottom'
                  }}
                />
              )}
              <div className="text-center text-sm font-medium mb-2">Performance & Efficiency Curve</div>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  margin={{ top: 20, right: 30, bottom: 20, left: 20 }}
                  onDoubleClick={(data) => {
                    if (data && data.activePayload && data.activePayload.length > 0) {
                      const headData = data.activePayload.find(p => p.name?.includes('양정'));
                      const efficiencyData = data.activePayload.find(p => p.name?.includes('효율'));
                      
                      if (headData && data.activeLabel !== undefined) {
                        const newPoint: OperatingPoint = {
                          flow: parseFloat(data.activeLabel.toString()),
                          head: parseFloat(headData.value.toString()),
                          efficiency: efficiencyData ? parseFloat(efficiencyData.value.toString()) : undefined
                        };
                        const newPoints = [...operatingPoints, newPoint].sort((a, b) => a.flow - b.flow);
                        setOperatingPoints(newPoints);
                        // 새로 추가된 점의 인덱스를 찾아서 설정
                        const newIndex = newPoints.findIndex(p => p.flow === newPoint.flow && p.head === newPoint.head);
                        setNewPointIndex(newIndex);
                        // 1초 후에 깜빡임 효과 제거
                        setTimeout(() => setNewPointIndex(null), 1000);
                      }
                    }
                  }}
                >
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="7"
                      refX="0"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill="#eab308" />
                    </marker>
                    <marker
                      id="arrowhead-up"
                      markerWidth="10"
                      markerHeight="7"
                      refX="0"
                      refY="3.5"
                      orient="auto-start-reverse"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill="#eab308" />
                    </marker>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="flow"
                    label={{ value: '유량 (m³/h)', position: 'bottom', style: { fontSize: '10px' } }}
                    type="number"
                    domain={[0, maxFlowInput]}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    yAxisId="head"
                    label={{ value: '양정 (m)', angle: -90, position: 'left', style: { fontSize: '10px' } }}
                    tick={{ fontSize: 10 }}
                    domain={[minHeadInput, maxHeadInput]}
                    padding={{ top: 20, bottom: 0 }}
                    allowDataOverflow={false}
                    scale="linear"
                    orientation="left"
                    tickCount={6}
                  />
                  <YAxis
                    yAxisId="efficiency"
                    orientation="right"
                    label={{ value: '효율 (%)', angle: 90, position: 'right', style: { fontSize: '10px' } }}
                    domain={[minEfficiencyInput, maxEfficiencyInput]}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => value.toFixed(1)}
                    allowDataOverflow={false}
                    allowDecimals={true}
                    scale="linear"
                    padding={{ top: 20, bottom: 0 }}
                    minTickGap={5}
                    axisLine={{ strokeWidth: 1 }}
                    tickLine={{ strokeWidth: 1 }}
                    tickCount={6}
                    width={45}
                  />
                  {operatingPoints.length >= 2 && (
                    <ReferenceLine
                      x={operatingPoints[1].flow}
                      stroke="#666"
                      strokeDasharray="3 3"
                      label={{
                        value: "min flow",
                        position: "top",
                        style: { fontSize: '10px' }
                      }}
                      yAxisId="head"
                    />
                  )}
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        // 추세선 데이터만 필터링
                        const trendlineData = payload.filter(entry => 
                          entry.name && typeof entry.name === 'string' && entry.name.includes('추세선')
                        );

                        return (
                          <div className="bg-white/80 backdrop-blur-sm px-2 py-1 rounded-sm border border-gray-200 shadow-sm text-xs">
                            <p>유량: {typeof label === 'number' ? label.toFixed(1) : label} m³/h</p>
                            {trendlineData.map((entry: any, index) => {
                              const unit = entry.name.includes('효율') ? '%' : 'm';
                              return (
                                <p key={index} style={{ color: entry.color }}>
                                  {entry.name.replace(' 추세선', '')}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value} {unit}
                                </p>
                              );
                            })}
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={{ stroke: '#666', strokeWidth: 1, strokeDasharray: '5 5' }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36}
                    wrapperStyle={{ fontSize: '10px' }}
                  />
                  {/* Performance Curves */}
                    <Line
                    yAxisId="head"
                    data={trendlinePoints.filter(point => point.flow <= maxOperatingFlow)}
                      type="monotone"
                      dataKey="head"
                    name={`양정 ${headPolynomialDegree}차 추세선`}
                    stroke="#dc2626"
                    strokeWidth={2}
                      dot={false}
                    activeDot={{ r: 4, stroke: '#dc2626', strokeWidth: 2, fill: '#fff' }}
                    />
                  <Line
                    yAxisId="head"
                    data={trendlinePoints.filter(point => point.flow >= maxOperatingFlow)}
                    type="monotone"
                    dataKey="head"
                    // name={`양정 ${headPolynomialDegree}차 추세선 (예측)`}
                    stroke="#dc2626"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{ r: 4, stroke: '#dc2626', strokeWidth: 2, fill: '#fff' }}
                  />
                  {showComparison && comparisonCase && (
                  <Line
                      yAxisId="head"
                      data={comparisonCase.operatingPoints}
                    type="monotone"
                    dataKey="head"
                      name={`비교 케이스 양정 (${comparisonCase.caseName})`}
                      stroke="#6b7280"
                      strokeWidth={6}
                      strokeOpacity={0.5}
                      dot={{ r: 4, fill: '#ffffff', stroke: '#6b7280', strokeWidth: 2 }}
                      activeDot={{ r: 4, stroke: '#6b7280', strokeWidth: 2, fill: '#fff' }}
                    />
                  )}
                  <Line
                    yAxisId="head"
                    data={operatingPoints}
                    type="monotone"
                    dataKey="head"
                    name="양정 운전점"
                    stroke="#2563eb"
                    strokeWidth={0}
                    dot={(props: any) => {
                      const { cx, cy, payload, index } = props;
                      const isDragging = draggedPoint?.index === index && draggedPoint?.type === 'head';
                      return (
                        <>
                          {(isDragging || isHovering === index || newPointIndex === index) && (
                            <>
                              <line
                                x1={cx}
                                y1="10%"
                                x2={cx}
                                y2="90%"
                                stroke={isDragging ? "#eab308" : "#666"}
                                strokeWidth={isDragging ? 2 : 1}
                                className={isDragging ? "vertical-arrow" : ""}
                              />
                              {isDragging && (
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={8}
                                  className={isDragging ? 'blinking-outer' : ''}
                    stroke="#dc2626"
                                />
                              )}
                              {newPointIndex === index && (
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={8}
                                  className="blinking-new"
                                  stroke="#dc2626"
                                />
                              )}
                            </>
                          )}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={4}
                            fill="#ffffff"
                  stroke="#2563eb"
                  strokeWidth={2}
                            className={isDragging || newPointIndex === index ? 'blinking' : ''}
                            style={{ 
                              cursor: isHovering === index ? 'ns-resize' : 'default', 
                              touchAction: 'none' 
                            }}
                            onMouseEnter={() => handleMouseEnter(index)}
                            onMouseLeave={handleMouseLeave}
                            onMouseDown={(e) => handleMouseDown(index, e, cx, 'head')}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              deletePoint(index);
                            }}
                          />
                        </>
                      );
                    }}
                    isAnimationActive={false}
                  />
                  {/* Efficiency Curves */}
                <Line
                    yAxisId="efficiency"
                  data={trendlinePoints.filter(point => point.flow <= maxOperatingFlow)}
                  type="monotone"
                    dataKey="efficiency"
                    name={`효율 ${efficiencyPolynomialDegree}차 추세선`}
                    stroke="#15803d"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, stroke: '#15803d', strokeWidth: 2, fill: '#fff' }}
                  />
                <Line
                    yAxisId="efficiency"
                    data={trendlinePoints.filter(point => point.flow >= maxOperatingFlow)}
                    type="monotone"
                    dataKey="efficiency"
                    // name={`효율 ${efficiencyPolynomialDegree}차 추세선 (예측)`}
                    stroke="#15803d"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{ r: 4, stroke: '#15803d', strokeWidth: 2, fill: '#fff' }}
                  />
                {showComparison && comparisonCase && (
                  <Line
                    yAxisId="efficiency"
                    data={comparisonCase.operatingPoints}
                    type="monotone"
                    dataKey="efficiency"
                    name={`비교 케이스 효율 (${comparisonCase.caseName})`}
                    stroke="#4b5563"
                    strokeWidth={6}
                    strokeOpacity={0.5}
                    dot={{ r: 4, fill: '#ffffff', stroke: '#4b5563', strokeWidth: 2 }}
                    activeDot={{ r: 4, stroke: '#4b5563', strokeWidth: 2, fill: '#fff' }}
                  />
                )}
                <Line
                    yAxisId="efficiency"
                    data={operatingPoints}
                    type="monotone"
                    dataKey="efficiency"
                    name="효율 운전점"
                    stroke="#16a34a"
                    strokeWidth={0}
                    dot={(props: any) => {
                      const { cx, cy, payload, index } = props;
                      const isDragging = draggedPoint?.index === index && draggedPoint?.type === 'efficiency';
                      return (
                        <>
                          {(isDragging || isHovering === index || newPointIndex === index) && (
                            <>
                              <line
                                x1={cx}
                                y1="10%"
                                x2={cx}
                                y2="90%"
                                stroke={isDragging ? "#eab308" : "#666"}
                                strokeWidth={isDragging ? 2 : 1}
                                className={isDragging ? "vertical-arrow" : ""}
                              />
                              {isDragging && (
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={8}
                                  className={isDragging ? 'blinking-outer' : ''}
                                  stroke="#15803d"
                                />
                              )}
                              {newPointIndex === index && (
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={8}
                                  className="blinking-new"
                                  stroke="#15803d"
                                />
                              )}
                            </>
                          )}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={4}
                            fill="#ffffff"
                            stroke="#16a34a"
                            strokeWidth={2}
                            className={isDragging || newPointIndex === index ? 'blinking' : ''}
                            style={{ 
                              cursor: isHovering === index ? 'ns-resize' : 'default', 
                              touchAction: 'none' 
                            }}
                            onMouseEnter={() => handleMouseEnter(index)}
                            onMouseLeave={handleMouseLeave}
                            onMouseDown={(e) => handleMouseDown(index, e, cx, 'efficiency')}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              deletePoint(index);
                            }}
                          />
                        </>
                      );
                    }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            </div>

            <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold">입력된 운전점</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyTableToClipboard}
                  className="flex items-center gap-1"
                >
                  <Copy className="h-4 w-4" />
                  <span>Copy</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToExcel}
                  className="flex items-center gap-1"
                >
                  <Download className="h-4 w-4" />
                  <span>Excel</span>
                  
                  
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToJson}
                  className="flex items-center gap-1 group relative"
                >
                  <FileJson className="h-4 w-4" />
                  <span>JSON</span>
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    저장위치: 바탕화면
                  </div>
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 select-all border-r">No.</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 select-all border-r">유량 (m³/h)</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 select-all border-r">양정 (m)</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 select-all border-r">효율 (%)</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                {operatingPoints.map((point, index) => (
                    <tr 
                      key={index}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-4 py-2 text-sm text-gray-900 select-all border-r">{index + 1}</td>
                      <td 
                        className="px-4 py-2 text-sm text-gray-900 cursor-pointer hover:bg-blue-50 border-r"
                        onClick={() => startEditing(index, 'flow', point.flow)}
                      >
                        {editingCell?.index === index && editingCell?.field === 'flow' ? (
                          <Input
                            type="number"
                            value={editValue}
                            onChange={handleEditChange}
                            onKeyDown={handleEditKeyDown}
                            onBlur={finishEditing}
                            className="w-20 h-6 p-0 text-sm"
                            autoFocus
                          />
                        ) : (
                          <span className="select-all">{point.flow}</span>
                        )}
                      </td>
                      <td 
                        className="px-4 py-2 text-sm text-gray-900 cursor-pointer hover:bg-blue-50 border-r"
                        onClick={() => startEditing(index, 'head', point.head)}
                      >
                        {editingCell?.index === index && editingCell?.field === 'head' ? (
                          <Input
                            type="number"
                            value={editValue}
                            onChange={handleEditChange}
                            onKeyDown={handleEditKeyDown}
                            onBlur={finishEditing}
                            className="w-20 h-6 p-0 text-sm"
                            autoFocus
                          />
                        ) : (
                          <span className="select-all">{point.head}</span>
                        )}
                      </td>
                      <td 
                        className="px-4 py-2 text-sm text-gray-900 cursor-pointer hover:bg-blue-50 border-r"
                        onClick={() => startEditing(index, 'efficiency', point.efficiency || 0)}
                      >
                        {editingCell?.index === index && editingCell?.field === 'efficiency' ? (
                          <Input
                            type="number"
                            value={editValue}
                            onChange={handleEditChange}
                            onKeyDown={handleEditKeyDown}
                            onBlur={finishEditing}
                            className="w-20 h-6 p-0 text-sm"
                            min="0"
                            max="100"
                            autoFocus
                          />
                        ) : (
                          <span className="select-all">{point.efficiency}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deletePoint(index)}
                      className="h-8 w-8 hover:bg-red-100 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {operatingPoints.length === 0 && (
                <div className="text-center py-4 text-sm text-gray-500">
                  입력된 운전점이 없습니다.
                </div>
              )}
              </div>
            </div>
          </CardContent>
      </div>
    </Card>
  );
} 