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

type SteamProperty = {
  temperature: number;
  pressure: number;
  saturatedLiquid: {
    specificVolume: number;
    specificGravity: number;
    enthalpy: number;
    entropy: number;
  };
  saturatedSteam: {
    specificVolume: number;
    enthalpy: number;
    entropy: number;
  };
  evaporation: {
    specificVolume: number;
    enthalpy: number;
    entropy: number;
  };
  isSaturated: boolean;
};

export default function SteamTableCalculator() {
  const [temperature, setTemperature] = useState<number>(100);
  const [pressure, setPressure] = useState<number>(1);
  const [result, setResult] = useState<SteamProperty | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedInput, setSelectedInput] = useState<'temperature' | 'pressure' | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const calculateSaturationPressure = (temp: number) => {
    // Antoine equation for water (valid from 0°C to 374°C)
    // P = 10^(A - B/(C + T)) where T is in °C
    const A = 8.07131;
    const B = 1730.63;
    const C = 233.426;
    const P = Math.pow(10, A - B/(C + temp));
    return P / 750.062; // Convert from mmHg to barg (1 bar = 750.062 mmHg)
  };

  const calculateSaturationTemperature = (press: number) => {
    // Inverse Antoine equation for water
    // T = B/(A - log10(P)) - C where P is in mmHg
    const A = 8.07131;
    const B = 1730.63;
    const C = 233.426;
    const P = press * 750.062; // Convert from barg to mmHg
    return B/(A - Math.log10(P)) - C;
  };

  const calculateSteamProperties = () => {
    let temp = temperature;
    let press = pressure;
    let isSaturated = false;

    if (selectedInput === 'temperature') {
      // Calculate pressure at saturation for given temperature
      press = calculateSaturationPressure(temp);
      isSaturated = true;
    } else if (selectedInput === 'pressure') {
      // Calculate temperature at saturation for given pressure
      temp = calculateSaturationTemperature(press);
      isSaturated = true;
    } else {
      // Check if the given temperature and pressure are at saturation
      const satPress = calculateSaturationPressure(temp);
      const satTemp = calculateSaturationTemperature(press);
      isSaturated = Math.abs(press - satPress) < 0.01 && Math.abs(temp - satTemp) < 0.01;
    }

    // More accurate calculations for saturated steam properties
    const T = temp + 273.15; // Convert to Kelvin
    const P = press * 100; // Convert to kPa

    // Saturated Liquid Properties
    const saturatedLiquid = {
      // Specific volume calculation based on temperature
      // Using a polynomial approximation for water density
      specificVolume: 0.001000 + (temp - 4) * 0.0000001, // m³/kg
      // Specific gravity calculation (density relative to water at 4°C)
      specificGravity: 1 - (temp - 4) * 0.0001, // kg/L
      enthalpy: 4.18 * temp, // kJ/kg
      entropy: 0.015 + 0.015 * temp, // kJ/kg·K
    };

    // Saturated Steam Properties
    const saturatedSteam = {
      specificVolume: 1.673 + (T - 273.15) * 0.005, // m³/kg
      enthalpy: 2500 + (T - 273.15) * 1.9, // kJ/kg
      entropy: 7.3549 + (T - 273.15) * 0.01, // kJ/kg·K
    };

    // Evaporation Properties (difference between saturated steam and liquid)
    const evaporation = {
      specificVolume: saturatedSteam.specificVolume - saturatedLiquid.specificVolume,
      enthalpy: saturatedSteam.enthalpy - saturatedLiquid.enthalpy,
      entropy: saturatedSteam.entropy - saturatedLiquid.entropy,
    };

    setResult({
      temperature: temp,
      pressure: press,
      saturatedLiquid,
      saturatedSteam,
      evaporation,
      isSaturated,
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      calculateSteamProperties();
    }
  };

  const handleTemperatureChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTemperature(Number(e.target.value));
  };

  const handlePressureChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPressure(Number(e.target.value));
  };

  const handleTemperatureCheck = (checked: boolean) => {
    if (checked) {
      setSelectedInput('temperature');
      setPressure(0); // Clear pressure input
    } else if (selectedInput === 'temperature') {
      setSelectedInput(null);
    }
  };

  const handlePressureCheck = (checked: boolean) => {
    if (checked) {
      setSelectedInput('pressure');
      setTemperature(0); // Clear temperature input
    } else if (selectedInput === 'pressure') {
      setSelectedInput(null);
    }
  };

  const copyToClipboard = (value: number) => {
    navigator.clipboard.writeText(value.toFixed(6));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard!");
  };

  const getUnit = (key: string) => {
    switch (key) {
      case 'temperature':
        return '°C';
      case 'pressure':
        return 'barg';
      case 'enthalpy':
        return 'kJ/kg';
      case 'entropy':
        return 'kJ/kg·K';
      case 'specificVolume':
        return 'm³/kg';
      case 'specificGravity':
        return 'kg/L';
      default:
        return '';
    }
  };

  const handleClose = () => {
    setResult(null);
  };

  const renderPropertySection = (title: string, properties: { specificVolume: number; enthalpy: number; entropy: number } | undefined) => {
    if (!properties) return null;
    
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium">{title}</div>
        {Object.entries(properties).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between rounded-md border  py-1 px-4">
            <div>
              {key}: {typeof value === 'number' ? 
                (key === 'specificVolume' ? value.toFixed(6) : value.toFixed(4)) 
                : value} {getUnit(key)}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-gray-200 active:bg-gray-300 transition-colors"
              onClick={() => copyToClipboard(value)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="text-lg sm:text-xl">Steam Table Calculator</CardTitle>
        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </div>
      {isExpanded && (
        <>
          <CardHeader className="px-4 pt-0 text-center">
            <CardDescription className="text-sm sm:text-base">
              Calculate steam properties based on temperature and pressure
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-2 sm:px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="temperature-check"
                    checked={selectedInput === 'temperature'}
                    onCheckedChange={handleTemperatureCheck}
                  />
                  <Label htmlFor="temperature-check" className="text-sm sm:text-base">Temperature (°C)</Label>
                </div>
                <Input
                  id="temperature"
                  type="number"
                  value={temperature}
                  onChange={handleTemperatureChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter temperature"
                  disabled={selectedInput === 'pressure'}
                  className="text-sm sm:text-base"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="pressure-check"
                    checked={selectedInput === 'pressure'}
                    onCheckedChange={handlePressureCheck}
                  />
                  <Label htmlFor="pressure-check" className="text-sm sm:text-base">Pressure (barg)</Label>
                </div>
                <Input
                  id="pressure"
                  type="number"
                  value={pressure}
                  onChange={handlePressureChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter pressure"
                  disabled={selectedInput === 'temperature'}
                  className="text-sm sm:text-base"
                />
              </div>
            </div>

            <Button 
              onClick={calculateSteamProperties}
              className="w-full bg-gray-600 hover:bg-gray-800 text-sm sm:text-base"
            >
              Calculate
            </Button>

            <Separator />

            {result !== null && (
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
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="flex items-center justify-between rounded-md border p-2">
                      <div className="text-sm sm:text-base">
                        Temperature: {result.temperature.toFixed(4)} °C
                      </div>
                      <div className="text-sm sm:text-base">
                        Pressure: {result.pressure.toFixed(4)} barg
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm sm:text-base font-medium">Saturated Liquid</div>
                      {Object.entries(result.saturatedLiquid).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between rounded-md border py-1 px-4">
                          <div className="text-sm sm:text-base">
                            {key}: {typeof value === 'number' ? 
                              (key === 'specificVolume' ? value.toFixed(6) : value.toFixed(4)) 
                              : value} {getUnit(key)}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-gray-200 active:bg-gray-300 transition-colors"
                            onClick={() => copyToClipboard(value)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm sm:text-base font-medium">Saturated Steam</div>
                      {Object.entries(result.saturatedSteam).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between rounded-md border py-1 px-4">
                          <div className="text-sm sm:text-base">
                            {key}: {typeof value === 'number' ? 
                              (key === 'specificVolume' ? value.toFixed(6) : value.toFixed(4)) 
                              : value} {getUnit(key)}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-gray-200 active:bg-gray-300 transition-colors"
                            onClick={() => copyToClipboard(value)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm sm:text-base font-medium">Evaporation</div>
                      {Object.entries(result.evaporation).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between rounded-md border py-1 px-4">
                          <div className="text-sm sm:text-base">
                            {key}: {typeof value === 'number' ? 
                              (key === 'specificVolume' ? value.toFixed(6) : value.toFixed(4)) 
                              : value} {getUnit(key)}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-gray-200 active:bg-gray-300 transition-colors"
                            onClick={() => copyToClipboard(value)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`rounded-md border py-2 px-4 ${result.isSaturated ? 'bg-green-50' : 'bg-yellow-50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="text-sm sm:text-base font-medium">
                        Status: {result.isSaturated ? 'Saturated' : 'Not Saturated'}
                      </div>
                      {result.isSaturated && <Check className="h-4 w-4 text-green-500" />}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </>
      )}
    </Card>
  );
} 