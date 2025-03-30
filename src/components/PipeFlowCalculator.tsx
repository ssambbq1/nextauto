'use client';

import { useState, ChangeEvent, KeyboardEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Copy, Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "react-hot-toast";

export default function PipeFlowCalculator() {
  const [diameter, setDiameter] = useState<number>(100); // mm
  const [flowrate, setFlowrate] = useState<number>(10); // m³/h
  const [velocity, setVelocity] = useState<number>(0.35); // m/s
  const [selectedInput, setSelectedInput] = useState<'diameter' | 'flowrate' | 'velocity' | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const calculatePipeFlow = () => {
    // Convert diameter from mm to m
    const d = diameter / 1000;
    // Convert flowrate from m³/h to m³/s
    const q = flowrate / 3600;

    if (selectedInput === 'diameter') {
      // Calculate diameter from flowrate and velocity
      // Q = A * v = (π * d²/4) * v
      // d = √(4Q/πv)
      const newDiameter = Math.sqrt((4 * q) / (Math.PI * velocity)) * 1000; // Convert back to mm
      setDiameter(Number(newDiameter.toFixed(2)));
    } else if (selectedInput === 'flowrate') {
      // Calculate flowrate from diameter and velocity
      // Q = A * v = (π * d²/4) * v
      const newFlowrate = (Math.PI * d * d / 4) * velocity * 3600; // Convert to m³/h
      setFlowrate(Number(newFlowrate.toFixed(2)));
    } else if (selectedInput === 'velocity') {
      // Calculate velocity from diameter and flowrate
      // v = Q/A = Q/(π * d²/4)
      const newVelocity = q / (Math.PI * d * d / 4);
      setVelocity(Number(newVelocity.toFixed(2)));
    }

    setShowResults(true);
  };

  const handleClose = () => {
    setShowResults(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      calculatePipeFlow();
    }
  };

  const handleDiameterChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDiameter(Number(e.target.value));
  };

  const handleFlowrateChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFlowrate(Number(e.target.value));
  };

  const handleVelocityChange = (e: ChangeEvent<HTMLInputElement>) => {
    setVelocity(Number(e.target.value));
  };

  const handleDiameterCheck = (checked: boolean) => {
    if (checked) {
      setSelectedInput('diameter');
      setDiameter(0);
    } else {
      setSelectedInput(null);
    }
  };

  const handleFlowrateCheck = (checked: boolean) => {
    if (checked) {
      setSelectedInput('flowrate');
      setFlowrate(0);
    } else {
      setSelectedInput(null);
    }
  };

  const handleVelocityCheck = (checked: boolean) => {
    if (checked) {
      setSelectedInput('velocity');
      setVelocity(0);
    } else {
      setSelectedInput(null);
    }
  };

  const copyToClipboard = (value: number) => {
    navigator.clipboard.writeText(value.toFixed(2));
    toast.success("Copied to clipboard!");
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="text-lg">Pipe Flow Calculator</CardTitle>
        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </div>
      {isExpanded && (
        <>
          <CardHeader className="px-4 pt-0 text-center">
            <CardDescription>
              Calculate pipe diameter, flowrate, or velocity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Button
                  variant={selectedInput === 'diameter' ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDiameterCheck(selectedInput !== 'diameter')}
                >
                  {selectedInput === 'diameter' && <X className="h-4 w-4" />}
                </Button>
                <Label>Diameter (mm)</Label>
              </div>
              <Input
                id="diameter"
                type="number"
                value={diameter}
                onChange={handleDiameterChange}
                onKeyDown={handleKeyDown}
                placeholder="Enter diameter"
                disabled={selectedInput === 'diameter'}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Button
                  variant={selectedInput === 'flowrate' ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleFlowrateCheck(selectedInput !== 'flowrate')}
                >
                  {selectedInput === 'flowrate' && <X className="h-4 w-4" />}
                </Button>
                <Label>Flowrate (m³/h)</Label>
              </div>
              <Input
                id="flowrate"
                type="number"
                value={flowrate}
                onChange={handleFlowrateChange}
                onKeyDown={handleKeyDown}
                placeholder="Enter flowrate"
                disabled={selectedInput === 'flowrate'}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Button
                  variant={selectedInput === 'velocity' ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleVelocityCheck(selectedInput !== 'velocity')}
                >
                  {selectedInput === 'velocity' && <X className="h-4 w-4" />}
                </Button>
                <Label>Velocity (m/s)</Label>
              </div>
              <Input
                id="velocity"
                type="number"
                value={velocity}
                onChange={handleVelocityChange}
                onKeyDown={handleKeyDown}
                placeholder="Enter velocity"
                disabled={selectedInput === 'velocity'}
              />
            </div>

            <Button 
              onClick={calculatePipeFlow}
              className="w-full bg-gray-600 hover:bg-gray-800"
            >
              Calculate
            </Button>

            {showResults && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="text-sm font-medium">Results</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClose}
                    >
                      Close
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-md border p-2">
                      <div>
                        Diameter: {diameter.toFixed(2)} mm
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-gray-200 active:bg-gray-300 transition-colors"
                        onClick={() => copyToClipboard(diameter)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-2">
                      <div>
                        Flowrate: {flowrate.toFixed(2)} m³/h
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-gray-200 active:bg-gray-300 transition-colors"
                        onClick={() => copyToClipboard(flowrate)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-2">
                      <div>
                        Velocity: {velocity.toFixed(2)} m/s
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-gray-200 active:bg-gray-300 transition-colors"
                        onClick={() => copyToClipboard(velocity)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </>
      )}
    </Card>
  );
} 