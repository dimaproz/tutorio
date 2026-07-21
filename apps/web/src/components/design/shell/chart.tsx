'use client';

import dynamic from 'next/dynamic';
import type { ApexOptions } from 'apexcharts';

// ApexCharts touches `window` on import, so it can only run in the browser.
// A client component + `ssr: false` dynamic import keeps it out of the server
// render; the card around it reserves height so nothing jumps on hydration.
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

// react-apexcharts accepts a narrower `type` union than apexcharts' own
// ApexOptions, so spell out the ones the lab uses rather than widening.
export type ChartProps = {
  type: 'bar' | 'line' | 'area' | 'radialBar' | 'donut' | 'pie';
  options: ApexOptions;
  series: ApexOptions['series'];
  height?: number | string;
  width?: number | string;
};

export function Chart({ type, options, series, height = 180, width = '100%' }: ChartProps) {
  return (
    <ReactApexChart
      type={type}
      options={options}
      series={series}
      height={height}
      width={width}
    />
  );
}
