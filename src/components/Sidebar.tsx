'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";

import { ChevronLeft, ChevronRight, Activity, LineChart, Droplets, Thermometer, GitBranch, Waves } from "lucide-react";
import Link from 'next/link';

const menuItems = [
  {
    title: "Pump Curve",
    href: "/pump-curve",
    icon: Waves
  },
  {
    title: "Pump Curve New 2",
    href: "/pump-curve-new-2",
    icon: Waves,
  },
  {
    title: "Steam Table",
    href: "/steam-table",
    icon: Thermometer,
    description: 'Calculate steam properties'
  },
  {
    title: "Seawater Property",
    href: "/seawater-property",
    icon: Droplets,
    description: 'Calculate seawater properties'
  },
  {
    title: "Pipe Flow",
    href: "/pipe-flow",
    icon: GitBranch,
    description: 'Calculate pipe flow characteristics'
  }
];

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className={`relative bg-gray-100 border-r border-gray-200 transition-all duration-300 ${isExpanded ? 'w-64' : 'w-16'}`}>
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-4 h-6 w-6 rounded-full border bg-white shadow-md"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronLeft className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </Button>

      <div className="p-4">
        <div className={`flex items-center gap-2 mb-8 ${isExpanded ? '' : 'justify-center'}`}>
          <Activity className="h-6 w-6 text-blue-600" />
          {isExpanded && (
            <span className="font-semibold text-lg">Pump Calculator</span>
          )}
        </div>

        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors
                  ${isActive 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'hover:bg-gray-200 text-gray-700'
                  }
                  ${!isExpanded && 'justify-center'}
                `}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {isExpanded && (
                  <span className="text-sm">{item.title}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
} 