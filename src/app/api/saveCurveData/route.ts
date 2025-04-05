import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface OperatingPoint {
  flow: number;
  head: number;
  efficiency?: number;
}

interface CaseData {
  caseName: string;
  operatingPoints: OperatingPoint[];
  maxValues: {
    head: number;
    efficiency: number;
  };
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

interface StoredData {
  cases: CaseData[];
}

export async function POST(request: Request) {
  try {
    const caseData: CaseData = await request.json();
    
    // 바탕화면 경로 설정
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const curvemakerPath = path.join(desktopPath, 'curvemaker');
    
    // curvemaker 폴더가 없으면 생성
    if (!fs.existsSync(curvemakerPath)) {
      fs.mkdirSync(curvemakerPath);
    }

    // 파일명에서 사용할 수 없는 특수문자 제거 또는 변환
    const sanitizedCaseName = caseData.caseName.replace(/[<>:"/\\|?*]/g, '_');
    const filePath = path.join(curvemakerPath, `${sanitizedCaseName}.json`);

    // 파일 저장
    fs.writeFileSync(filePath, JSON.stringify(caseData, null, 2));

    return NextResponse.json({ 
      success: true, 
      message: `${caseData.caseName} 케이스가 저장되었습니다.`,
      filePath: filePath 
    });
  } catch (error) {
    console.error('파일 저장 오류:', error);
    return NextResponse.json(
      { success: false, message: 'JSON 파일 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 