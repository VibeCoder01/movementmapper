import React from 'react';

const Heatmap = ({ logs, weekRanges, isAggregateMode, isSumMode, onCellClick, onCellHover, hoveredCell, highlightedCriteria, adjustments }) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    // Process data for a single week
    const processWeekData = (weekLogs, weekStart, weekEnd) => {
        const grid = Array(24).fill().map(() => Array(7).fill(0));
        const adjustmentGrid = Array(24).fill().map(() => Array(7).fill(false));

        if (!weekLogs) return { grid, adjustmentGrid };

        weekLogs.forEach(log => {
            if (log.value === 'active') {
                const date = new Date(log.timestamp);
                const hour = date.getHours();
                const day = date.getDay();
                grid[hour][day]++;
            }
        });

        // Apply adjustments to the grid
        if (adjustments && adjustments.length > 0) {


            // Create a map to store total adjustments per slot to avoid order-of-operation issues
            const adjustmentMap = new Map(); // Key: "day-hour", Value: totalAdjustment

            adjustments.forEach(adj => {
                // Ensure timestamp is treated as UTC by appending 'Z' if not present
                let timestamp = adj.timestamp;
                if (!timestamp.endsWith('Z') && !timestamp.includes('+')) {
                    timestamp = timestamp + 'Z';
                }
                const adjDate = new Date(timestamp);

                // Check if this adjustment falls within this week's range
                if (adjDate >= weekStart && adjDate < weekEnd) {
                    // Use local time to match how logs are processed
                    const hour = adjDate.getHours();
                    const day = adjDate.getDay();
                    const key = `${day}-${hour}`;

                    const currentTotal = adjustmentMap.get(key) || 0;
                    adjustmentMap.set(key, currentTotal + adj.value);
                }
            });

            // Apply aggregated adjustments to the grid
            adjustmentMap.forEach((totalAdj, key) => {
                const [day, hour] = key.split('-').map(Number);
                const oldValue = grid[hour][day];
                grid[hour][day] = Math.max(0, grid[hour][day] + totalAdj);
                adjustmentGrid[hour][day] = true;
            });
        }

        return { grid, adjustmentGrid };
    };

    // Check if a week has any data
    const hasData = (grid) => {
        return grid.some(row => row.some(val => val > 0));
    };

    // Dynamic color function using normalized red shades
    const getColor = (count, maxCount) => {
        if (count === 0) return { className: 'bg-gray-100', style: {} };

        // Normalize the count (0 to 1)
        const normalized = maxCount > 0 ? count / maxCount : 0;

        // Calculate lightness: from 95% (very light red) to 25% (dark red)
        const lightness = 95 - (normalized * 70);

        // Determine if text should be white (for darker backgrounds)
        const textWhite = lightness < 60;

        return {
            className: textWhite ? 'text-white' : '',
            style: { backgroundColor: `hsl(0, 85%, ${lightness}%)` }
        };
    };

    const isHighlighted = (day, hour, date = null) => {
        if (!highlightedCriteria) return false;
        if (highlightedCriteria.type === 'cell') {
            const match = highlightedCriteria.day === day && highlightedCriteria.hour === hour;
            if (match && highlightedCriteria.date && date) {
                return highlightedCriteria.date.getTime() === date.getTime();
            }
            return match;
        }
        return false;
    };

    const isHovered = (day, hour) => {
        if (!hoveredCell) return false;
        return hoveredCell.day === day && hoveredCell.hour === hour;
    };

    // Color Legend Component
    const ColorLegend = ({ maxCount, sumValues = [] }) => {
        // Generate gradient stops
        const stops = [];
        const numStops = 20;
        for (let i = 0; i <= numStops; i++) {
            const normalized = i / numStops;
            const lightness = 95 - (normalized * 70);
            stops.push(`hsl(0, 85%, ${lightness}%) ${(normalized * 100).toFixed(1)}%`);
        }
        const gradientStyle = {
            background: `linear-gradient(to right, ${stops.join(', ')})`
        };

        return (
            <div className="mt-6 w-full">
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700">0</span>
                    <div className="flex-1 h-8 rounded relative" style={gradientStyle}>
                        {/* Render vertical markers for each sum value */}
                        {sumValues.map((sumValue, idx) => {
                            if (sumValue === 0 || maxCount === 0) return null;
                            const position = (sumValue / maxCount) * 100;
                            return (
                                <div
                                    key={idx}
                                    className="absolute top-0 bottom-0 w-0.5 bg-black"
                                    style={{ left: `${position}%` }}
                                    title={`Count: ${sumValue}`}
                                />
                            );
                        })}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{maxCount}</span>
                </div>
                <div className="text-center text-xs text-gray-500 mt-1">Activity Count</div>
            </div>
        );
    };

    // Render aggregate mode (single heatmap with sub-cells)
    if (isAggregateMode && weekRanges && weekRanges.length > 0) {
        // Process data for each week
        const processedWeeks = weekRanges.map(range => {
            const weekLogs = logs.filter(log => {
                const logDate = new Date(log.timestamp);
                return logDate >= range.start && logDate < range.end;
            });
            return processWeekData(weekLogs, range.start, range.end);
        });

        // Calculate max count from total counts (sums) and collect unique sum values
        let maxCount = 0;
        const allSumValues = new Set();

        // Collect all total counts (sums) for the legend markers and find max
        days.forEach((_, dayIndex) => {
            hours.forEach(hour => {
                const weekCounts = processedWeeks.map(pw => pw.grid[hour][dayIndex]);
                const totalCount = weekCounts.reduce((sum, c) => sum + c, 0);
                if (totalCount > maxCount) maxCount = totalCount;
                if (totalCount > 0) {
                    allSumValues.add(totalCount);
                }
            });
        });

        const uniqueSumValues = Array.from(allSumValues).sort((a, b) => a - b);

        return (
            <div>
                <div className="overflow-x-auto">
                    <table className="text-xs">
                        <thead>
                            <tr>
                                <th className="p-1"></th>
                                {hours.map(hour => (
                                    <th key={hour} className="p-1">{hour}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {days.map((dayName, dayIndex) => (
                                <tr key={dayName}>
                                    <td className="p-1 font-medium text-gray-500 text-right pr-2">{dayName}</td>
                                    {hours.map(hour => {
                                        // Get counts for all weeks for this day/hour
                                        const weekCounts = processedWeeks.map(pw => pw.grid[hour][dayIndex]);
                                        const weekAdjustments = processedWeeks.map(pw => pw.adjustmentGrid[hour][dayIndex]);
                                        const totalCount = weekCounts.reduce((sum, c) => sum + c, 0);
                                        const highlighted = isHighlighted(dayIndex, hour);
                                        const colorInfo = getColor(totalCount, maxCount);

                                        // Show zeros only if at least one partner sub-cell is non-zero
                                        const hasAnyNonZero = totalCount > 0;

                                        return (
                                            <td
                                                key={hour}
                                                className={`p-0 border border-gray-400 cursor-pointer hover:opacity-80 w-10 h-10 ${colorInfo.className} ${highlighted ? 'ring-4 ring-orange-400 z-10' : ''}`}
                                                style={colorInfo.style}
                                                onClick={() => onCellClick && onCellClick({ day: dayIndex, hour, date: null })}
                                                title={`Total: ${totalCount}`}
                                            >
                                                {/* Sub-cells in a row OR Sum Mode */}
                                                {isSumMode ? (
                                                    <div className="flex items-center justify-center h-full w-full font-semibold text-xs text-gray-700">
                                                        {totalCount > 0 ? totalCount : ''}
                                                        {/* Show adjustment indicator if any week has adjustment */}
                                                        {weekAdjustments.some(adj => adj) && (
                                                            <div className="absolute top-0 right-0 w-2 h-2 bg-orange-500 rounded-full m-0.5" title="Adjusted"></div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    hasAnyNonZero ? (
                                                        <div className="flex">
                                                            {weekCounts.map((count, weekIdx) => (
                                                                <div
                                                                    key={weekIdx}
                                                                    className={`flex-1 text-center py-2 px-1 ${weekIdx > 0 ? 'border-l border-black/10' : ''} relative flex items-center justify-center h-full`}
                                                                    style={{ minWidth: '20px' }}
                                                                >
                                                                    {count}
                                                                    {weekAdjustments[weekIdx] && (
                                                                        <div className="absolute top-0 right-0 w-2 h-2 bg-orange-500 rounded-full m-0.5" title="Adjusted"></div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="flex">
                                                            {weekCounts.map((count, weekIdx) => (
                                                                <div
                                                                    key={weekIdx}
                                                                    className={`flex-1 text-center py-2 px-1 ${weekIdx > 0 ? 'border-l border-black/10' : ''} relative flex items-center justify-center h-full`}
                                                                    style={{ minWidth: '20px' }}
                                                                >
                                                                    {weekAdjustments[weekIdx] && (
                                                                        <div className="absolute top-0 right-0 w-2 h-2 bg-orange-500 rounded-full m-0.5" title="Adjusted"></div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <ColorLegend maxCount={maxCount} sumValues={uniqueSumValues} />
            </div>
        );
    }

    // Render multiple heatmaps (one per week)
    if (weekRanges && weekRanges.length > 0) {
        // First pass: process all weeks and calculate max count
        const allProcessedWeeks = weekRanges.map(range => {
            const weekLogs = logs.filter(log => {
                const logDate = new Date(log.timestamp);
                return logDate >= range.start && logDate < range.end;
            });
            return { range, ...processWeekData(weekLogs, range.start, range.end) };
        });

        // Calculate max count across all weeks and collect unique values
        let maxCount = 0;
        const allCountValues = new Set();
        allProcessedWeeks.forEach(({ grid }) => {
            grid.forEach(row => {
                row.forEach(count => {
                    if (count > maxCount) maxCount = count;
                    if (count > 0) allCountValues.add(count);
                });
            });
        });

        const uniqueCountValues = Array.from(allCountValues).sort((a, b) => a - b);

        return (
            <div>
                <div className="flex flex-wrap justify-center gap-8">
                    {allProcessedWeeks.map(({ range, grid, adjustmentGrid }, rangeIdx) => {
                        return (
                            <div key={rangeIdx} className="overflow-x-auto flex flex-col items-center">
                                <h3 className="text-lg font-semibold mb-2">{range.label}</h3>
                                <table className="text-xs mx-auto">
                                    <thead>
                                        <tr>
                                            <th className="p-1"></th>
                                            {hours.map(hour => (
                                                <th key={hour} className="p-1">{hour}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {days.map((dayName, dayIndex) => (
                                            <tr key={dayName}>
                                                <td className="p-1 font-medium text-gray-500 text-right pr-2">{dayName}</td>
                                                {hours.map(hour => {
                                                    const count = grid[hour][dayIndex];
                                                    const hasAdjustment = adjustmentGrid[hour][dayIndex];
                                                    const cellDate = new Date(range.start);
                                                    cellDate.setDate(cellDate.getDate() + dayIndex);
                                                    cellDate.setHours(hour, 0, 0, 0);

                                                    const highlighted = isHighlighted(dayIndex, hour, cellDate);
                                                    const hovered = isHovered(dayIndex, hour);
                                                    const colorInfo = getColor(count, maxCount);

                                                    return (
                                                        <td
                                                            key={hour}
                                                            className={`p-0 border text-center relative ${colorInfo.className} cursor-pointer hover:opacity-80 w-10 h-10 ${highlighted ? 'ring-4 ring-orange-400 z-10' : ''} ${hovered ? 'ring-4 ring-purple-600 ring-inset z-20' : ''}`}
                                                            style={colorInfo.style}
                                                            onClick={() => onCellClick && onCellClick({ day: dayIndex, hour, date: cellDate })}
                                                            onMouseEnter={() => {
                                                                onCellHover && onCellHover({ day: dayIndex, hour });
                                                            }}
                                                            onMouseLeave={() => {
                                                                onCellHover && onCellHover(null);
                                                            }}
                                                        >
                                                            {count > 0 ? count : ''}
                                                            {hasAdjustment && (
                                                                <div className="absolute top-0 right-0 w-2 h-2 bg-orange-500 rounded-full m-1" title="Adjusted"></div>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}
                </div>
                <ColorLegend maxCount={maxCount} sumValues={uniqueCountValues} />
            </div>
        );
    }

    // Fallback: render empty state
    return <div className="text-gray-500 italic">No data to display</div>;
};

export default Heatmap;
