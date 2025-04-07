'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Trash2, Copy, Table, Download, Upload, FileUp, Image as ImageIcon } from "lucide-react";

interface Point {
  x: number;
  y: number;
}

interface DefaultDataPoint {
  flow: string;
  head?: string;
  efficiency?: string;
}

interface DefaultData {
  caseInfo: {
  caseName: string;
    projectName: string;
    stage: string;
    date: string;
    pumpName: string;
  };
  maxValues: {
    head: number;
    flow: number;
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
  points: {
    headPoints: DefaultDataPoint[];
    efficiencyPoints: DefaultDataPoint[];
  };
}

const PumpCurveNew2: React.FC = () => {
  const [points, setPoints] = useState<Point[]>([]);
  const [efficiencyPoints, setEfficiencyPoints] = useState<Point[]>([]);
  const [selectedMode, setSelectedMode] = useState<'head' | 'efficiency'>('head');
  const [headDegree, setHeadDegree] = useState(2);
  const [efficiencyDegree, setEfficiencyDegree] = useState(2);
  const [maxHead, setMaxHead] = useState<number>(100);
  const [maxFlow, setMaxFlow] = useState<number>(100);
  const [maxEfficiency, setMaxEfficiency] = useState<number>(100);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPoint, setDraggedPoint] = useState<{
    index: number;
    field: 'x' | 'y';
    x: number;
    type: 'head' | 'efficiency';
  } | null>(null);
  const [dragMode, setDragMode] = useState<'head' | 'efficiency' | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [headEquation, setHeadEquation] = useState<string>('');
  const [efficiencyEquation, setEfficiencyEquation] = useState<string>('');
  const [caseInfo, setCaseInfo] = useState({
    caseName: '',
    projectName: '',
    stage: '수행',
    date: new Date().toISOString().split('T')[0],
    pumpName: ''
  });
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [imageOpacity, setImageOpacity] = useState(0.5);

  const sortedPoints = [...points].sort((a, b) => a.x - b.x);
  const sortedEfficiencyPoints = [...efficiencyPoints].sort((a, b) => a.x - b.x);

  const calculatePolynomialCoefficients = (xValues: number[], yValues: number[], degree: number) => {
    const X: number[][] = [];
    const y: number[] = [];
    
    for (let i = 0; i < xValues.length; i++) {
      X[i] = Array(degree + 1).fill(0);
      for (let j = 0; j <= degree; j++) {
        X[i][j] = Math.pow(xValues[i], j);
      }
      y[i] = yValues[i];
    }
    
    return solveLinearSystem(X, y);
  };

  const solveLinearSystem = (X: number[][], y: number[]): number[] => {
    const n = X[0].length;
    const m = X.length;
    
    // Calculate X^T * X
    const XtX: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        for (let k = 0; k < m; k++) {
          XtX[i][j] += X[k][i] * X[k][j];
        }
      }
    }
    
    // Calculate X^T * y
    const Xty: number[] = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        Xty[i] += X[j][i] * y[j];
      }
    }
    
    // Solve using Gaussian elimination
    const augmentedMatrix = XtX.map((row, i) => [...row, Xty[i]]);
    
    // Forward elimination
    for (let i = 0; i < n; i++) {
      const pivot = augmentedMatrix[i][i];
      for (let j = i; j <= n; j++) {
        augmentedMatrix[i][j] /= pivot;
      }
      for (let j = i + 1; j < n; j++) {
        const factor = augmentedMatrix[j][i];
        for (let k = i; k <= n; k++) {
          augmentedMatrix[j][k] -= factor * augmentedMatrix[i][k];
        }
      }
    }
    
    // Back substitution
    const solution = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      solution[i] = augmentedMatrix[i][n];
      for (let j = i + 1; j < n; j++) {
        solution[i] -= augmentedMatrix[i][j] * solution[j];
      }
    }
    
    return solution;
  };

  const calculateActualPolynomialCoefficients = (points: Point[], degree: number, maxX: number, maxY: number) => {
    if (points.length < 2) return [];

    const actualPoints = points.map(point => ({
      x: (point.x * maxX) / 100,
      y: (point.y * maxY) / 100,
    }));

    const n = actualPoints.length;
    const matrix: number[][] = [];
    const vector: number[] = [];

    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j <= degree; j++) {
        row.push(Math.pow(actualPoints[i].x, j));
      }
      matrix.push(row);
      vector.push(actualPoints[i].y);
    }

    const coefficients = solveLinearSystem(matrix, vector);
    return coefficients.reverse();
  };

  const formatEquation = (coefficients: number[]) => {
    if (coefficients.length === 0) return '';

    return coefficients
      .map((coef, index) => {
        const power = coefficients.length - 1 - index;
        if (power === 0) return coef.toFixed(12);
        if (power === 1) return `${coef.toFixed(12)}x`;
        return `${coef.toFixed(12)}x^${power}`;
      })
      .join(' + ');
  };

  const drawPolynomialTrendline = (
    canvas: HTMLCanvasElement, 
    ctx: CanvasRenderingContext2D, 
    points: Point[], 
    degree: number, 
    color: string,
    padding: { left: number; right: number; top: number; bottom: number },
    drawingWidth: number,
    drawingHeight: number
  ) => {
    if (points.length <= degree) return;

    const xValues = points.map(p => p.x);
    const yValues = points.map(p => p.y);
    const coefficients = calculatePolynomialCoefficients(xValues, yValues, degree);

    ctx.beginPath();
    ctx.strokeStyle = color;

    const maxFlow = Math.max(...xValues);

    for (let x = 0; x <= maxFlow; x += 1) {
      const y = coefficients.reduce((acc, coeff, index) => acc + coeff * Math.pow(x, index), 0);
      const canvasX = padding.left + (x / 100) * drawingWidth;
      const canvasY = padding.top + (1 - y / 100) * drawingHeight;
      
      if (x === 0) {
        ctx.moveTo(canvasX, canvasY);
      } else {
        ctx.lineTo(canvasX, canvasY);
      }
    }

    ctx.stroke();

    // Draw points as dots
    points.forEach(point => {
      const x = padding.left + (point.x / 100) * drawingWidth;
      const y = padding.top + (1 - point.y / 100) * drawingHeight;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size with padding for labels
    canvas.width = 1200;
    canvas.height = 800;

    // Define padding and drawing area
    const padding = {
      left: 60,
      right: 40,
      top: 40,
      bottom: 60
    };

    const drawingWidth = canvas.width - padding.left - padding.right;
    const drawingHeight = canvas.height - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background image if exists
    if (backgroundImage) {
      ctx.save();
      ctx.globalAlpha = imageOpacity;
      
      // Draw image to fill the entire drawing area
      ctx.drawImage(
        backgroundImage,
        padding.left,
        padding.top,
        drawingWidth,
        drawingHeight
      );
      ctx.restore();
    }

    // Draw grid
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;

    // Vertical grid lines with actual flow values
    for (let i = 0; i <= 10; i++) {
      const x = padding.left + (drawingWidth / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, canvas.height - padding.bottom);
      ctx.stroke();

      // Draw actual flow values
      const actualFlow = ((i * 10) * maxFlow / 100).toFixed(1);
      ctx.fillStyle = '#000';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(actualFlow.toString(), x, canvas.height - padding.bottom / 2);

      // Draw intermediate values (at 5% intervals)
      if (i < 10) {
        const xMid = x + (drawingWidth / 10) / 2;
        const actualFlowMid = ((i * 10 + 5) * maxFlow / 100).toFixed(1);
        ctx.font = '12px Arial';
        ctx.fillText(actualFlowMid.toString(), xMid, canvas.height - padding.bottom / 2);
      }
    }

    // Horizontal grid lines with percentage and actual values
    for (let i = 0; i <= 10; i++) {
      const y = padding.top + (drawingHeight / 10) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvas.width - padding.right, y);
      ctx.stroke();

      // Calculate actual values
      const percentage = 100 - i * 10;
      const actualHead = ((percentage * maxHead) / 100).toFixed(1);
      const actualEfficiency = ((percentage * maxEfficiency) / 100).toFixed(1);

      // Draw percentage values on the left (with Head)
      ctx.fillStyle = '#0000FF'; // Blue for Head
      ctx.font = '14px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`${percentage}% (${actualHead})`, padding.left - 10, y + 5);

      // Draw actual Efficiency values on the right
      ctx.fillStyle = '#FF0000'; // Red for Efficiency
      ctx.textAlign = 'left';
      ctx.fillText(`${percentage}% (${actualEfficiency})`, canvas.width - padding.right + 10, y + 5);
    }

    // Add Y-axis labels
    ctx.save();
    
    // Left Y-axis label (Head)
    ctx.fillStyle = '#0000FF';
    ctx.translate(20, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Head (actual)', 0, 0);
    
    // Right Y-axis label (Efficiency)
    ctx.fillStyle = '#FF0000';
    ctx.translate(0, -(canvas.width - 40));
    ctx.fillText('Efficiency (actual)', 0, 0);
    
    ctx.restore();

    // Draw axes
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;

    // X-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, canvas.height - padding.bottom);
    ctx.lineTo(canvas.width - padding.right, canvas.height - padding.bottom);
    ctx.stroke();

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, canvas.height - padding.bottom);
    ctx.stroke();

    // Add x-axis label
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Flow (actual)', canvas.width / 2, canvas.height - 10);

    // Draw trendlines
    ctx.lineWidth = 2;
    if (points.length > 0) {
      drawPolynomialTrendline(canvas, ctx, points, headDegree, '#0000FF', padding, drawingWidth, drawingHeight);
    }
    if (efficiencyPoints.length > 0) {
      drawPolynomialTrendline(canvas, ctx, efficiencyPoints, efficiencyDegree, '#FF0000', padding, drawingWidth, drawingHeight);
    }

    // Calculate and set equations
    const headCoefficients = calculateActualPolynomialCoefficients(points, headDegree, maxFlow, maxHead);
    const efficiencyCoefficients = calculateActualPolynomialCoefficients(efficiencyPoints, efficiencyDegree, maxFlow, maxEfficiency);
    
    setHeadEquation(headCoefficients ? formatEquation(headCoefficients) : '');
    setEfficiencyEquation(efficiencyCoefficients ? formatEquation(efficiencyCoefficients) : '');
  }, [points, efficiencyPoints, headDegree, efficiencyDegree, maxFlow, maxHead, maxEfficiency, backgroundImage, imageOpacity]);

  useEffect(() => {
    const newCaseName = [
      caseInfo.projectName,
      caseInfo.stage,
      caseInfo.pumpName,
      caseInfo.date
    ]
      .filter(Boolean) // Remove empty values
      .join('_');
    
    if (newCaseName !== caseInfo.caseName) {
      setCaseInfo(prev => ({ ...prev, caseName: newCaseName }));
    }
  }, [caseInfo.projectName, caseInfo.stage, caseInfo.pumpName, caseInfo.date]);

  const findClosestPoint = (x: number, y: number, points: Point[]) => {
    if (points.length === 0) return { index: -1, distance: Infinity };

    let minDistance = Infinity;
    let closestIndex = -1;

    points.forEach((point, index) => {
      const distance = Math.sqrt(
        Math.pow(point.x - x, 2) + 
        Math.pow(point.y - y, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    return { index: closestIndex, distance: minDistance };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2) {
      handleCanvasClick(e);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const padding = {
      left: 60,
      right: 40,
      top: 40,
      bottom: 60
    };

    const rect = canvas.getBoundingClientRect();
    const drawingWidth = canvas.width - padding.left - padding.right;
    const drawingHeight = canvas.height - padding.top - padding.bottom;

    const x = ((e.clientX - rect.left - padding.left) / drawingWidth) * 100;
    const y = (1 - (e.clientY - rect.top - padding.top) / drawingHeight) * 100;

    // Find the closest point
    const headResult = findClosestPoint(x, y, points);
    const efficiencyResult = findClosestPoint(x, y, efficiencyPoints);

    // Determine which point is closer
    if (headResult.distance < efficiencyResult.distance && headResult.distance < 5) {
      setIsDragging(true);
      setDraggedPoint({ index: headResult.index, field: 'x', x, type: 'head' });
      setDragMode('head');
    } else if (efficiencyResult.distance < 5) {
      setIsDragging(true);
      setDraggedPoint({ index: efficiencyResult.index, field: 'x', x, type: 'efficiency' });
      setDragMode('efficiency');
    } else if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
      // If no point is close enough, add a new point
      handleCanvasClick(e);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !draggedPoint) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const padding = {
      left: 60,
      right: 40,
      top: 40,
      bottom: 60
    };

    const rect = canvas.getBoundingClientRect();
    const drawingWidth = canvas.width - padding.left - padding.right;
    const drawingHeight = canvas.height - padding.top - padding.bottom;

    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left - padding.left) / drawingWidth) * 100));
    const y = Math.max(0, Math.min(100, (1 - (e.clientY - rect.top - padding.top) / drawingHeight) * 100));

    if (dragMode === 'head') {
      const newPoints = [...points];
      newPoints[draggedPoint.index] = { 
        x: parseFloat(x.toFixed(1)), 
        y: parseFloat(y.toFixed(1)) 
      };
      setPoints(newPoints);
    } else {
      const newPoints = [...efficiencyPoints];
      newPoints[draggedPoint.index] = { 
        x: parseFloat(x.toFixed(1)), 
        y: parseFloat(y.toFixed(1)) 
      };
      setEfficiencyPoints(newPoints);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
      setDraggedPoint(null);
    setDragMode(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const padding = {
      left: 60,
      right: 40,
      top: 40,
      bottom: 60
    };

    const rect = canvas.getBoundingClientRect();
    const drawingWidth = canvas.width - padding.left - padding.right;
    const drawingHeight = canvas.height - padding.top - padding.bottom;

    const x = ((e.clientX - rect.left - padding.left) / drawingWidth) * 100;
    const y = (1 - (e.clientY - rect.top - padding.top) / drawingHeight) * 100;

    // Right click to delete the closest point
    if (e.button === 2) {
      e.preventDefault();
      const clickPoint = { x, y };
      const currentPoints = selectedMode === 'head' ? points : efficiencyPoints;
      
      if (currentPoints.length === 0) return;

      // Find the closest point
      let minDistance = Infinity;
      let closestPointIndex = -1;

      currentPoints.forEach((point, index) => {
        const distance = Math.sqrt(
          Math.pow(point.x - clickPoint.x, 2) + 
          Math.pow(point.y - clickPoint.y, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestPointIndex = index;
        }
      });

      // Delete the closest point if it's within a reasonable distance
      if (minDistance < 5) {
        handleDeletePoint(closestPointIndex, selectedMode);
      }
      return;
    }

    // Left click to add new point (only if within drawing area)
    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
      const newPoint = { x: parseFloat(x.toFixed(1)), y: parseFloat(y.toFixed(1)) };

      if (selectedMode === 'head') {
        setPoints(prev => [...prev, newPoint]);
      } else {
        setEfficiencyPoints(prev => [...prev, newPoint]);
      }
    }
  };

  const handleEditPoint = (index: number, type: 'head' | 'efficiency', newX: number, newY: number) => {
    if (type === 'head') {
      const newPoints = [...points];
      newPoints[index] = { x: newX, y: newY };
      setPoints(newPoints);
    } else {
      const newPoints = [...efficiencyPoints];
      newPoints[index] = { x: newX, y: newY };
      setEfficiencyPoints(newPoints);
    }
  };

  const handleDeletePoint = (index: number, type: 'head' | 'efficiency') => {
    if (type === 'head') {
      setPoints(prev => prev.filter((_, i) => i !== index));
    } else {
      setEfficiencyPoints(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleCopyEquation = (equation: string) => {
    navigator.clipboard.writeText(equation);
  };

  const handleCopyAllPoints = () => {
    const headData = sortedPoints.map((point, index) => ({
      no: index + 1,
      flow: ((point.x * maxFlow) / 100).toFixed(1),
      head: ((point.y * maxHead) / 100).toFixed(1)
    }));

    const efficiencyData = sortedEfficiencyPoints.map((point, index) => ({
      no: index + 1,
      flow: ((point.x * maxFlow) / 100).toFixed(1),
      efficiency: ((point.y * maxEfficiency) / 100).toFixed(1)
    }));

    // Create table format string
    let tableText = "Head Points:\n";
    tableText += "No\tFlow\tHead\n";
    headData.forEach(row => {
      tableText += `${row.no}\t${row.flow}\t${row.head}\n`;
    });

    tableText += "\nEfficiency Points:\n";
    tableText += "No\tFlow\tEfficiency\n";
    efficiencyData.forEach(row => {
      tableText += `${row.no}\t${row.flow}\t${row.efficiency}\n`;
    });

    navigator.clipboard.writeText(tableText);
  };

  const handleExportJson = () => {
    const data = {
      caseInfo: {
        caseName: caseInfo.caseName,
        projectName: caseInfo.projectName,
        stage: caseInfo.stage,
        date: caseInfo.date,
        pumpName: caseInfo.pumpName
      },
      maxValues: {
        head: maxHead,
        flow: maxFlow,
        efficiency: maxEfficiency
      },
      equations: {
        head: {
          degree: headDegree,
          equation: headEquation
        },
        efficiency: {
          degree: efficiencyDegree,
          equation: efficiencyEquation
        }
      },
      points: {
        headPoints: sortedPoints.map(point => ({
          flow: ((point.x * maxFlow) / 100).toFixed(1),
          head: ((point.y * maxHead) / 100).toFixed(1)
        })),
        efficiencyPoints: sortedEfficiencyPoints.map(point => ({
          flow: ((point.x * maxFlow) / 100).toFixed(1),
          efficiency: ((point.y * maxEfficiency) / 100).toFixed(1)
        }))
      }
    };

    // Create blob and download
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${caseInfo.caseName || 'pump_data'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loadDefaultData = async () => {
    try {
      const response = await fetch('/pump_data_export_2025-04-07.json');
      const data: DefaultData = await response.json();
      
      // Update case info
      setCaseInfo(data.caseInfo);
      
      // Update max values
      setMaxHead(data.maxValues.head);
      setMaxFlow(data.maxValues.flow);
      setMaxEfficiency(data.maxValues.efficiency);
      
      // Update degrees if available
      if (data.equations?.head?.degree) {
        setHeadDegree(data.equations.head.degree);
      }
      if (data.equations?.efficiency?.degree) {
        setEfficiencyDegree(data.equations.efficiency.degree);
      }
      
      // Update points
      const headPoints = data.points.headPoints.map(point => ({
        x: (parseFloat(point.flow) * 100) / data.maxValues.flow,
        y: (parseFloat(point.head!) * 100) / data.maxValues.head
      }));
      setPoints(headPoints);
      
      const efficiencyPoints = data.points.efficiencyPoints.map(point => ({
        x: (parseFloat(point.flow) * 100) / data.maxValues.flow,
        y: (parseFloat(point.efficiency!) * 100) / data.maxValues.efficiency
      }));
      setEfficiencyPoints(efficiencyPoints);
    } catch (error) {
      console.error('Error loading default data:', error);
    }
  };

  const loadJsonFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result;
        if (typeof content !== 'string') return;
        
        const data: DefaultData = JSON.parse(content);
        
        // Update case info
        setCaseInfo(data.caseInfo);
        
        // Update max values
        setMaxHead(data.maxValues.head);
        setMaxFlow(data.maxValues.flow);
        setMaxEfficiency(data.maxValues.efficiency);
        
        // Update degrees if available
        if (data.equations?.head?.degree) {
          setHeadDegree(data.equations.head.degree);
        }
        if (data.equations?.efficiency?.degree) {
          setEfficiencyDegree(data.equations.efficiency.degree);
        }
        
        // Update points
        const headPoints = data.points.headPoints.map(point => ({
          x: (parseFloat(point.flow) * 100) / data.maxValues.flow,
          y: (parseFloat(point.head!) * 100) / data.maxValues.head
        }));
        setPoints(headPoints);
        
        const efficiencyPoints = data.points.efficiencyPoints.map(point => ({
          x: (parseFloat(point.flow) * 100) / data.maxValues.flow,
          y: (parseFloat(point.efficiency!) * 100) / data.maxValues.efficiency
        }));
        setEfficiencyPoints(efficiencyPoints);
      } catch (error) {
        console.error('Error loading JSON file:', error);
        alert('Invalid JSON file format');
      }
    };
    reader.readAsText(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/json") {
      loadJsonFile(file);
    } else {
      alert('Please select a JSON file');
    }
  };

  // Add paste event listener
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (!file) continue;

          const img = new Image();
          img.src = URL.createObjectURL(file);
          img.onload = () => {
            setBackgroundImage(img);
            URL.revokeObjectURL(img.src);
          };
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Add clear background image function
  const clearBackgroundImage = () => {
    setBackgroundImage(null);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg flex-grow mr-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="caseName">Case 명:</Label>
                <Input
                  id="caseName"
                  value={caseInfo.caseName}
                  readOnly
                  className="flex-1 bg-gray-100"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="projectName">PJT:</Label>
                <Input
                  id="projectName"
                  value={caseInfo.projectName}
                  onChange={(e) => setCaseInfo(prev => ({ ...prev, projectName: e.target.value }))}
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="stage">단계:</Label>
                <select
                  id="stage"
                  title="단계 선택"
                  value={caseInfo.stage}
                  onChange={(e) => setCaseInfo(prev => ({ ...prev, stage: e.target.value }))}
                  className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="수행">수행</option>
                  <option value="견적">견적</option>
                  <option value="기타">기타</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="date">입력일:</Label>
                <Input
                  id="date"
                  type="date"
                  value={caseInfo.date}
                  onChange={(e) => setCaseInfo(prev => ({ ...prev, date: e.target.value }))}
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="pumpName">Pump 명:</Label>
                <Input
                  id="pumpName"
                  value={caseInfo.pumpName}
                  onChange={(e) => setCaseInfo(prev => ({ ...prev, pumpName: e.target.value }))}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadDefaultData}
                className="flex items-center gap-2 h-10"
              >
                <Upload className="h-4 w-4" />
                Load Default
              </Button>
              <div className="relative">
              <input
                type="file"
                accept=".json"
                  onChange={handleFileSelect}
                className="hidden"
                  id="json-file-input"
                  title="Select JSON file to load"
                  aria-label="Select JSON file to load"
              />
              <Button
                variant="outline"
                size="sm"
                  onClick={() => document.getElementById('json-file-input')?.click()}
                  className="flex items-center gap-2 h-10"
              >
                  <FileUp className="h-4 w-4" />
                  Load JSON
              </Button>
            </div>
            </div>
            </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label htmlFor="maxHead">Head 최대값:</Label>
              <Input
                id="maxHead"
                  type="number"
                value={maxHead}
                onChange={(e) => setMaxHead(parseFloat(e.target.value) || 100)}
                className="w-24"
                />
              </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="maxFlow">Flow 최대값:</Label>
              <Input
                id="maxFlow"
                  type="number"
                value={maxFlow}
                onChange={(e) => setMaxFlow(parseFloat(e.target.value) || 100)}
                className="w-24"
                />
              </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="maxEfficiency">Efficiency 최대값:</Label>
              <Input
                id="maxEfficiency"
                type="number"
                value={maxEfficiency}
                onChange={(e) => setMaxEfficiency(parseFloat(e.target.value) || 100)}
                className="w-24"
              />
            </div>
              <Button
              variant={selectedMode === 'head' ? 'default' : 'outline'}
              onClick={() => setSelectedMode('head')}
            >
              Head
            </Button>
            <Button
              variant={selectedMode === 'efficiency' ? 'default' : 'outline'}
              onClick={() => setSelectedMode('efficiency')}
            >
              Efficiency
              </Button>
            </div>

          <div className="flex gap-4">
            <div>
              <span className="mr-2">Head Degree:</span>
              {[2, 3, 4].map((degree) => (
                <Button
                  key={degree}
                  variant={headDegree === degree ? 'default' : 'outline'}
                  onClick={() => setHeadDegree(degree)}
                  className="mx-1"
                >
                  {degree}
                </Button>
              ))}
            </div>
            <div>
              <span className="mr-2">Efficiency Degree:</span>
              {[2, 3, 4].map((degree) => (
                <Button
                  key={degree}
                  variant={efficiencyDegree === degree ? 'default' : 'outline'}
                  onClick={() => setEfficiencyDegree(degree)}
                  className="mx-1"
                >
                  {degree}
                </Button>
              ))}
            </div>
              </div>

          <div className="border rounded-lg p-4">
            {/* Add image controls */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="imageOpacity">Background Opacity:</Label>
                <Input
                  id="imageOpacity"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={imageOpacity}
                  onChange={(e) => setImageOpacity(parseFloat(e.target.value))}
                  className="w-32"
                />
                <span>{(imageOpacity * 100).toFixed(0)}%</span>
              </div>
              {backgroundImage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearBackgroundImage}
                  className="flex items-center gap-2"
                >
                  <ImageIcon className="h-4 w-4" />
                  Clear Background
                </Button>
              )}
            </div>
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onContextMenu={handleCanvasClick}
              className="border rounded"
              style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
            />
            {/* Move trend line equations here */}
            <div className="mt-4 space-y-4">
              {headEquation && (
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-grow">
                    <span className="font-semibold text-blue-600">Head = </span>
                    <span className="font-mono">{headEquation}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyEquation(headEquation)}
                    className="flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
              )}

              {efficiencyEquation && (
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-grow">
                    <span className="font-semibold text-red-600">Efficiency = </span>
                    <span className="font-mono">{efficiencyEquation}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyEquation(efficiencyEquation)}
                    className="flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Points Data</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAllPoints}
                  className="flex items-center gap-2"
                >
                  <Table className="h-4 w-4" />
                  Copy All Points
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportJson}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export JSON
                </Button>
                  </div>
              </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Head Points</h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border p-2">No</th>
                    <th className="border p-2">Flow (%)</th>
                    <th className="border p-2">Flow (actual)</th>
                    <th className="border p-2">Head (%)</th>
                    <th className="border p-2">Head (actual)</th>
                    <th className="border p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPoints.map((point, index) => (
                    <tr key={index}>
                      <td className="border p-2 text-center">{index + 1}</td>
                      <td className="border p-2 text-center">
                        <input
                            type="number"
                          value={point.x}
                          onChange={(e) => handleEditPoint(index, 'head', parseFloat(e.target.value), point.y)}
                          className="w-20 text-center"
                          title={`Edit flow percentage for point ${index + 1}`}
                          placeholder="Flow %"
                        />
                      </td>
                      <td className="border p-2 text-center">
                        {((point.x * maxFlow) / 100).toFixed(1)}
                      </td>
                      <td className="border p-2 text-center">
                        <input
                            type="number"
                          value={point.y}
                          onChange={(e) => handleEditPoint(index, 'head', point.x, parseFloat(e.target.value))}
                          className="w-20 text-center"
                          title={`Edit head percentage for point ${index + 1}`}
                          placeholder="Head %"
                        />
                      </td>
                      <td className="border p-2 text-center">
                        {((point.y * maxHead) / 100).toFixed(1)}
                      </td>
                      <td className="border p-2 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePoint(index, 'head')}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Efficiency Points</h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border p-2">No</th>
                    <th className="border p-2">Flow (%)</th>
                    <th className="border p-2">Flow (actual)</th>
                    <th className="border p-2">Efficiency (%)</th>
                    <th className="border p-2">Efficiency (actual)</th>
                    <th className="border p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEfficiencyPoints.map((point, index) => (
                    <tr key={index}>
                      <td className="border p-2 text-center">{index + 1}</td>
                      <td className="border p-2 text-center">
                        <input
                            type="number"
                          value={point.x}
                          onChange={(e) => handleEditPoint(index, 'efficiency', parseFloat(e.target.value), point.y)}
                          className="w-20 text-center"
                          title={`Edit flow percentage for efficiency point ${index + 1}`}
                          placeholder="Flow %"
                        />
                      </td>
                      <td className="border p-2 text-center">
                        {((point.x * maxFlow) / 100).toFixed(1)}
                      </td>
                      <td className="border p-2 text-center">
                        <input
                          type="number"
                          value={point.y}
                          onChange={(e) => handleEditPoint(index, 'efficiency', point.x, parseFloat(e.target.value))}
                          className="w-20 text-center"
                          title={`Edit efficiency percentage for point ${index + 1}`}
                          placeholder="Efficiency %"
                        />
                      </td>
                      <td className="border p-2 text-center">
                        {((point.y * maxEfficiency) / 100).toFixed(1)}
                      </td>
                      <td className="border p-2 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                          onClick={() => handleDeletePoint(index, 'efficiency')}
                          className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                </div>
              </div>
            </div>
          </CardContent>
    </Card>
  );
};

export default PumpCurveNew2; 