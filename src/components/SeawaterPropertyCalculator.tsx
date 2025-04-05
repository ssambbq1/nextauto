'use client';

import { useState, ChangeEvent, KeyboardEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Copy, Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { toast } from "react-hot-toast";

export default function SeawaterPropertyCalculator() {
  const [temperature, setTemperature] = useState<number>(35);
  const [salinity, setSalinity] = useState<number>(42000);
  const [specificGravity, setSpecificGravity] = useState<number | null>(null);
  const [viscosity, setViscosity] = useState<number | null>(null);
  const [vaporPressure, setVaporPressure] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const calculateProperties = () => {
    if (temperature === null || salinity === null) return;

    // Calculate specific gravity using the formula
    // SG = 1 + (0.0008 * salinity) - (0.0002 * temperature)
    // This formula provides more accurate results for seawater
    const sg = 1 + (0.0008 * salinity / 1000) - (0.0002 * temperature);
    setSpecificGravity(sg);

    // Calculate viscosity (mPa·s) using temperature
    // μ = 1.002 + 0.0337 * T + 0.000221 * T²
    const viscosity = 1.002 + 0.0337 * temperature + 0.000221 * temperature * temperature;
    setViscosity(viscosity);

    // Calculate vapor pressure (bar) using temperature and salinity
    // Pv = Pv0 * (1 - 0.0005 * salinity)
    // where Pv0 is the vapor pressure of pure water
    // Pv0 = 0.006112 * exp((17.67 * T) / (T + 243.5))
    const pv0 = 0.006112 * Math.exp((17.67 * temperature) / (temperature + 243.5));
    const vaporPressure = pv0 * (1 - 0.0005 * salinity / 1000);
    setVaporPressure(vaporPressure);

    setShowResults(true);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      calculateProperties();
    }
  };

  const handleTemperatureChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTemperature(Number(e.target.value));
  };

  const handleSalinityChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSalinity(Number(e.target.value));
  };

  const copyToClipboard = (value: number | null) => {
    if (value !== null) {
      navigator.clipboard.writeText(value.toFixed(4));
      setCopied(true);
      setTimeout(() => setCopied(false), 500);
      toast.success("Copied to clipboard!");
    }
  };

  const handleClose = () => {
    setShowResults(false);
    setSpecificGravity(null);
    setViscosity(null);
    setVaporPressure(null);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <div className="p-4">
        <CardTitle className="text-lg sm:text-xl mb-4">Seawater Property Calculator</CardTitle>
        <CardDescription className="text-sm sm:text-base text-center mb-6">
          Calculate seawater properties based on temperature and salinity
        </CardDescription>
        <CardContent className="space-y-4 px-2 sm:px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label htmlFor="temperature" className="text-sm sm:text-base">Temperature (°C)</Label>
              <Input
                id="temperature"
                type="number"
                value={temperature}
                onChange={handleTemperatureChange}
                onKeyDown={handleKeyDown}
                placeholder="Enter temperature"
                className="text-sm sm:text-base"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="salinity" className="text-sm sm:text-base">Salinity (ppm)</Label>
              <Input
                id="salinity"
                type="number"
                value={salinity}
                onChange={handleSalinityChange}
                onKeyDown={handleKeyDown}
                placeholder="Enter salinity"
                className="text-sm sm:text-base"
              />
            </div>
          </div>

          <Button 
            onClick={calculateProperties}
            className="w-full bg-gray-600 hover:bg-gray-800 text-sm sm:text-base"
          >
            Calculate
          </Button>

          {showResults && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="text-sm sm:text-base font-medium">Results</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClose}
                    className="text-xs sm:text-sm"
                  >
                    Close
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  <div className="flex items-center justify-between rounded-md border p-2">
                    <div className="text-sm sm:text-base">
                      Specific Gravity: {specificGravity?.toFixed(4)} kg/L
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-gray-200 active:bg-gray-300 transition-colors"
                      onClick={() => copyToClipboard(specificGravity)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-2">
                    <div className="text-sm sm:text-base">
                      Viscosity: {viscosity?.toFixed(4)} mPa·s
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-gray-200 active:bg-gray-300 transition-colors"
                      onClick={() => copyToClipboard(viscosity)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-2">
                    <div className="text-sm sm:text-base">
                      Vapor Pressure: {vaporPressure?.toFixed(4)} bar
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-gray-200 active:bg-gray-300 transition-colors"
                      onClick={() => copyToClipboard(vaporPressure)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </div>
    </Card>
  );
} 