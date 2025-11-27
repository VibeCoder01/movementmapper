import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';

import Heatmap from './components/Heatmap';

import AdjustmentModal from './components/AdjustmentModal';
import SettingsModal from './components/SettingsModal';

function App() {
    const [sensors, setSensors] = useState([]);
    const [logs, setLogs] = useState([]);

    const [adjustments, setAdjustments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [demoLoading, setDemoLoading] = useState(false);
    const [selectedSensors, setSelectedSensors] = useState(new Set());
    const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.
    const [weeksToView, setWeeksToView] = useState(1); // 1-12 = specific weeks
    const [isAggregateMode, setIsAggregateMode] = useState(false);
    const [isSumMode, setIsSumMode] = useState(false);
    const [excludeToday, setExcludeToday] = useState(true);
    const [excludeFirstDay, setExcludeFirstDay] = useState(true);

    const [selectedHeatmapCell, setSelectedHeatmapCell] = useState(null);
    const [highlightedCriteria, setHighlightedCriteria] = useState(null);
    const [hoveredCell, setHoveredCell] = useState(null); // {day, hour} for hover highlighting

    // Adjustment Modal State
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [adjustmentTarget, setAdjustmentTarget] = useState(null); // { timestamp, sensorId, currentAdjustment }

    // Settings Modal State
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    const isInitialized = useRef(false);
    const previousLogCount = useRef(0);
    const previousWeeksToView = useRef(0);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
        return () => clearInterval(interval);
    }, []);

    // Position view at latest data when weeksToView changes
    useEffect(() => {
        // Only update if weeksToView actually changed
        const hasChanged = weeksToView !== previousWeeksToView.current;

        if (hasChanged && weeksToView > 0 && logs.length > 0) {
            // Find the latest data point from ALL logs
            const dates = logs.map(l => new Date(l.timestamp));
            const latestDate = new Date(Math.max(...dates));

            const now = new Date();
            const currentWeekStart = new Date(now);
            currentWeekStart.setDate(now.getDate() - now.getDay());
            currentWeekStart.setHours(0, 0, 0, 0);

            // Find the week containing the latest data
            const latestWeekStart = new Date(latestDate);
            latestWeekStart.setDate(latestDate.getDate() - latestDate.getDay());
            latestWeekStart.setHours(0, 0, 0, 0);

            const offsetMs = latestWeekStart.getTime() - currentWeekStart.getTime();
            const offset = Math.round(offsetMs / (7 * 24 * 60 * 60 * 1000));

            setWeekOffset(offset);
        }
        previousWeeksToView.current = weeksToView;
    }, [weeksToView, logs]);

    const fetchData = async () => {
        try {
            const [sensorsRes, logsRes, adjustmentsRes] = await Promise.all([
                axios.get('/api/sensors'),
                axios.get('/api/logs?limit=50000'),
                axios.get('/api/adjustments')
            ]);
            setSensors(sensorsRes.data);
            setLogs(logsRes.data);
            setAdjustments(adjustmentsRes.data);

            // ... existing auto-select logic ...
            if (!isInitialized.current && sensorsRes.data.length > 0) {
                setSelectedSensors(new Set(sensorsRes.data.map(s => s.id)));
                isInitialized.current = true;
            }

            // Prune selectedSensors of any IDs that are no longer in the sensors list
            // This prevents "ghost" selections from deleted sensors
            setSelectedSensors(prev => {
                const currentSensorIds = new Set(sensorsRes.data.map(s => s.id));
                const newSelection = new Set();
                prev.forEach(id => {
                    if (currentSensorIds.has(id)) {
                        newSelection.add(id);
                    }
                });
                // If selection became empty but we have sensors, select all (default behavior)
                if (newSelection.size === 0 && sensorsRes.data.length > 0) {
                    return new Set(sensorsRes.data.map(s => s.id));
                }
                return newSelection;
            });

            if (logsRes.data.length > previousLogCount.current) {
                // setWeeksToView(0); // Removed auto-reset to All-Time
                previousLogCount.current = logsRes.data.length;
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };



    const generateDemoData = async () => {
        setDemoLoading(true);
        try {
            const response = await axios.post('/api/demo/generate');
            alert(response.data.message + `\n${response.data.logs_created} activity logs created`);
            fetchData();
        } catch (error) {
            console.error('Error generating demo data:', error);
            alert('Failed to generate demo data');
        } finally {
            setDemoLoading(false);
        }
    };

    const clearDemoData = async () => {
        // if (!confirm('Are you sure you want to clear all demo data?')) return;
        setDemoLoading(true);
        try {
            const response = await axios.post('/api/demo/clear');
            alert(response.data.message);

            // Reset local state immediately
            setLogs([]);
            setSensors([]); // Clear sensors too as they are deleted
            setAdjustments([]); // Clear adjustments as they might be orphaned or irrelevant

            // Then fetch fresh data (which should be empty)
            await fetchData();
        } catch (error) {
            console.error('Error clearing demo data:', error);
            alert('Failed to clear demo data');
        } finally {
            setDemoLoading(false);
        }
    };
    const toggleSensor = (sensorId) => {
        setSelectedSensors(prevSelectedSensors => {
            const newSelectedSensors = new Set(prevSelectedSensors);
            if (newSelectedSensors.has(sensorId)) {
                newSelectedSensors.delete(sensorId);
            } else {
                newSelectedSensors.add(sensorId);
            }
            return newSelectedSensors;
        });
    };

    // Week navigation functions
    const handleWeekBackward = () => {
        setWeekOffset(prev => prev - 1);
    };

    const handleWeekForward = () => {
        setWeekOffset(prev => prev + 1);
    };

    // Auto-adjust weekOffset when weeksToView changes to show most recent data
    const hasAutoAdjusted = useRef(false);

    useEffect(() => {
        if (weeksToView > 0 && logs.length > 0 && !hasAutoAdjusted.current) {
            // Find the most recent log date
            const mostRecentLog = logs.reduce((latest, log) => {
                const logDate = new Date(log.timestamp);
                return logDate > latest ? logDate : latest;
            }, new Date(logs[0].timestamp));

            // Calculate how many weeks back from now the most recent data is
            const now = new Date();
            const weeksSinceNow = Math.floor((now - mostRecentLog) / (7 * 24 * 60 * 60 * 1000));

            // Set offset to show the most recent data
            setWeekOffset(-weeksSinceNow);
            hasAutoAdjusted.current = true;
        }

        // Reset the flag when weeksToView changes so it can auto-adjust again
        return () => {
            if (weeksToView > 0) {
                hasAutoAdjusted.current = false;
            }
        };
    }, [weeksToView]); // Only depend on weeksToView, not logs

    // Calculate data bounds
    const { minDate, maxDate } = useMemo(() => {
        if (!logs || logs.length === 0) return { minDate: new Date(), maxDate: new Date() };
        let min = new Date(logs[0].timestamp);
        let max = new Date(logs[0].timestamp);
        logs.forEach(l => {
            const d = new Date(l.timestamp);
            if (d < min) min = d;
            if (d > max) max = d;
        });
        return { minDate: min, maxDate: max };
    }, [logs]);

    // Calculate minWeekOffset based on minDate
    const minWeekOffset = useMemo(() => {
        const now = new Date();
        const diffTime = Math.abs(now - minDate);
        const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
        return -diffWeeks - 1; // Add a buffer week
    }, [minDate]);





    // Calculate date range for current week offset
    const getWeekRange = () => {
        if (weeksToView === 0) {
            return { start: minDate, end: maxDate };
        }
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + ((weekOffset || 0) * 7));
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + (7 * weeksToView));
        return { start: startOfWeek, end: endOfWeek };
    };

    const { start: weekStart, end: weekEnd } = getWeekRange();

    // Calculate first activity date for each sensor
    const sensorFirstDates = useMemo(() => {
        const firstDates = new Map();
        logs.forEach(log => {
            const logDate = new Date(log.timestamp);
            logDate.setHours(0, 0, 0, 0); // Normalize to start of day

            if (!firstDates.has(log.sensor_id) || logDate < firstDates.get(log.sensor_id)) {
                firstDates.set(log.sensor_id, logDate);
            }
        });
        return firstDates;
    }, [logs]);

    // Calculate today's date range
    const { todayStart, todayEnd } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return { todayStart: today, todayEnd: tomorrow };
    }, []);

    // Filter adjustments based on selected sensors and date exclusions
    const filteredAdjustments = useMemo(() => {
        if (!adjustments) return [];
        return adjustments.filter(adj => {
            // Include only adjustments for selected sensors
            // Global adjustments (sensor_id === null) are no longer supported/displayed
            if (adj.sensor_id === null) return false;

            // If no sensors selected (All Sensors view), include all sensor adjustments?
            // User said "Adjustments should only be localaised".
            // If viewing all sensors, we probably want to see all localized adjustments aggregated.
            if (selectedSensors.size === 0) return true;

            // Otherwise, include only adjustments for selected sensors
            if (!selectedSensors.has(adj.sensor_id)) return false;

            // Apply date exclusion filters
            let timestamp = adj.timestamp;
            if (!timestamp.endsWith('Z') && !timestamp.includes('+')) {
                timestamp = timestamp + 'Z';
            }
            const adjDate = new Date(timestamp);

            // Apply exclude today filter
            if (excludeToday) {
                if (adjDate >= todayStart && adjDate < todayEnd) return false;
            }

            // Apply exclude first day filter
            if (excludeFirstDay) {
                const firstDate = sensorFirstDates.get(adj.sensor_id);
                if (firstDate) {
                    const adjDayStart = new Date(adjDate);
                    adjDayStart.setHours(0, 0, 0, 0);
                    if (adjDayStart.getTime() === firstDate.getTime()) return false;
                }
            }

            return true;
        });
    }, [adjustments, selectedSensors, excludeToday, excludeFirstDay, todayStart, todayEnd, sensorFirstDates]);

    // Filter logs by selected sensors and optionally by week/4-week range
    const filteredLogs = logs.filter(log => {
        if (!selectedSensors.has(log.sensor_id)) return false;
        const logDate = new Date(log.timestamp);
        if (isNaN(logDate.getTime())) return false;
        if (!(logDate >= weekStart && logDate < weekEnd)) return false;

        // Apply exclude today filter
        if (excludeToday) {
            if (logDate >= todayStart && logDate < todayEnd) return false;
        }

        // Apply exclude first day filter
        if (excludeFirstDay) {
            const firstDate = sensorFirstDates.get(log.sensor_id);
            if (firstDate) {
                const logDayStart = new Date(logDate);
                logDayStart.setHours(0, 0, 0, 0);
                if (logDayStart.getTime() === firstDate.getTime()) return false;
            }
        }

        return true;
    });

    // Calculate week ranges for Heatmap component
    const weekRanges = useMemo(() => {
        if (weeksToView === 0) {
            // All-time view: return single range with proper boundaries
            // Start at the beginning of the week containing minDate
            const start = new Date(minDate);
            start.setHours(0, 0, 0, 0);
            start.setDate(start.getDate() - start.getDay()); // Go to Sunday

            // End at the end of the week containing maxDate
            const end = new Date(maxDate);
            end.setHours(23, 59, 59, 999);
            end.setDate(end.getDate() + (6 - end.getDay())); // Go to Saturday end

            return [{
                start,
                end,
                label: 'All Time'
            }];
        }

        const ranges = [];
        const now = new Date();
        const baseStartOfWeek = new Date(now);
        baseStartOfWeek.setDate(now.getDate() - now.getDay() + (weekOffset * 7));
        baseStartOfWeek.setHours(0, 0, 0, 0);

        for (let i = 0; i < weeksToView; i++) {
            const startOfWeek = new Date(baseStartOfWeek);
            startOfWeek.setDate(baseStartOfWeek.getDate() + (i * 7));

            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 7);

            const startStr = startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endStr = new Date(endOfWeek.getTime() - 1).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            ranges.push({
                start: startOfWeek,
                end: endOfWeek,
                label: `Week of ${startStr} - ${endStr}`
            });
        }
        return ranges;
    }, [weeksToView, weekOffset, minDate, maxDate]);



    // Format week range for display
    const formatWeekRange = () => {
        if (isNaN(weekStart.getTime()) || isNaN(weekEnd.getTime())) return 'Invalid Date Range';
        if (weeksToView === 0) return 'All Time';
        const options = { month: 'short', day: 'numeric' };
        return `${weekStart.toLocaleDateString(undefined, options)} - ${new Date(weekEnd.getTime() - 1).toLocaleDateString(undefined, options)}`;
    };

    const handleHeatmapClick = ({ day, hour, date }) => {
        // Always select, never deselect on click
        setHighlightedCriteria({ type: 'cell', day, hour, date });
        setSelectedHeatmapCell({ day, hour, date });
    };



    const handleSaveAdjustment = async (newValue, comment) => {
        if (!adjustmentTarget) return;

        // Calculate offset: newOffset = newValue - rawCount - otherAdjustments
        // We stored rawCount and otherAdjustmentsValue in adjustmentTarget
        const newOffset = newValue - adjustmentTarget.rawCount - adjustmentTarget.otherAdjustmentsValue;

        console.log('Saving adjustment:', {
            timestamp: adjustmentTarget.timestamp,
            sensor_id: adjustmentTarget.sensorId,
            value: newOffset,
            comment,
            newValue,
            rawCount: adjustmentTarget.rawCount,
            otherAdjustmentsValue: adjustmentTarget.otherAdjustmentsValue
        });

        try {
            // Consolidate adjustments: Delete all existing adjustments for this slot first
            // This ensures we don't have duplicates with slightly different timestamps
            if (adjustmentTarget.currentAdjustment && adjustmentTarget.currentAdjustment.ids) {
                for (const id of adjustmentTarget.currentAdjustment.ids) {
                    await axios.delete(`/api/adjustments/${id}`);
                }
            }

            const response = await axios.post('/api/adjustments', {
                timestamp: adjustmentTarget.timestamp,
                sensor_id: adjustmentTarget.sensorId,
                value: newOffset,
                comment
            });
            console.log('Adjustment saved successfully:', response.data);
            await fetchData();
            setIsAdjustmentModalOpen(false);
            setAdjustmentTarget(null);
        } catch (error) {
            console.error('Error saving adjustment:', error);
            console.error('Error response:', error.response?.data);
            alert('Failed to save adjustment: ' + (error.response?.data?.detail || error.message));
        }
    };

    const handleClearAdjustment = async () => {
        if (!adjustmentTarget || !adjustmentTarget.currentAdjustment) return;

        if (!window.confirm('Are you sure you want to clear this adjustment?')) return;

        try {
            // Delete all adjustments for this slot (using ids array)
            if (adjustmentTarget.currentAdjustment.ids) {
                for (const id of adjustmentTarget.currentAdjustment.ids) {
                    await axios.delete(`/api/adjustments/${id}`);
                }
            }
            console.log('Adjustment(s) deleted successfully');
            await fetchData();
            setIsAdjustmentModalOpen(false);
            setAdjustmentTarget(null);
        } catch (error) {
            console.error('Error deleting adjustment:', error);
            alert('Failed to delete adjustment: ' + (error.response?.data?.detail || error.message));
        }
    };

    const openAdjustmentModal = (timestamp, sensorId = null) => {
        let targetSensorId = sensorId;

        // If no specific sensor passed, try to determine from selection
        if (!targetSensorId) {
            // Filter selectedSensors to ensure they are all valid existing sensors
            const validSelectedSensors = Array.from(selectedSensors).filter(id =>
                sensors.some(s => s.id === id)
            );

            if (validSelectedSensors.length === 1) {
                targetSensorId = validSelectedSensors[0];
            } else {
                // If multiple sensors or no sensors selected, we cannot adjust
                alert("Please select a single sensor to make adjustments.");
                return;
            }
        }

        // The timestamp passed in is the target slot timestamp (specific date/hour)
        const slotDate = new Date(timestamp);

        // Calculate Raw Count for this specific slot
        const rawLogs = logs.filter(log => {
            const d = new Date(log.timestamp);
            // Check if log is in the same hour of the same date
            // We use a small window or exact hour match
            const timeMatch = d.getFullYear() === slotDate.getFullYear() &&
                d.getMonth() === slotDate.getMonth() &&
                d.getDate() === slotDate.getDate() &&
                d.getHours() === slotDate.getHours();

            if (!timeMatch) return false;
            if (log.value !== 'active') return false;
            if (targetSensorId && log.sensor_id !== targetSensorId) return false;
            return true;
        });
        const rawCount = rawLogs.length;

        // Use the slot date directly as the canonical timestamp
        // It's already set to the correct hour from the clicked cell
        const canonicalTimestamp = new Date(slotDate);
        canonicalTimestamp.setMinutes(0, 0, 0);

        // Find ALL existing adjustments for this canonical timestamp (hour slot) and sensor
        // We match by checking if the adjustment falls within the same hour
        const existingAdjustments = filteredAdjustments.filter(a => {
            // Ensure timestamp is treated as UTC by appending 'Z' if not present
            let timestamp = a.timestamp;
            if (timestamp && !timestamp.endsWith('Z') && !timestamp.includes('+')) {
                timestamp = timestamp + 'Z';
            }
            const adjDate = new Date(timestamp);

            return adjDate.getFullYear() === canonicalTimestamp.getFullYear() &&
                adjDate.getMonth() === canonicalTimestamp.getMonth() &&
                adjDate.getDate() === canonicalTimestamp.getDate() &&
                adjDate.getHours() === canonicalTimestamp.getHours() &&
                a.sensor_id === targetSensorId;
        });

        // Calculate total existing adjustment value
        const totalExistingAdjustmentValue = existingAdjustments.reduce((sum, a) => sum + a.value, 0);

        // DEBUG LOGGING
        console.log('=== openAdjustmentModal Debug ===');
        console.log('Slot Date:', slotDate.toISOString());
        console.log('Raw Logs Count:', rawCount);
        console.log('Existing Adjustments:', existingAdjustments);
        console.log('Total Adjustment Value:', totalExistingAdjustmentValue);
        console.log('Calculated Current Total:', rawCount + totalExistingAdjustmentValue);

        // Create a synthetic adjustment object to represent the aggregate
        // We include the IDs so we can clean them up on save
        const existingAdjustment = existingAdjustments.length > 0 ? {
            value: totalExistingAdjustmentValue,
            ids: existingAdjustments.map(a => a.id),
            timestamp: canonicalTimestamp.toISOString(), // Use canonical for display/logic
            sensor_id: targetSensorId
        } : null;

        // Calculate other adjustments
        // Since we enforced single sensor, there are no "other" adjustments from other sensors
        // And we removed global adjustments.
        const otherAdjustmentsValue = 0;

        // Current Total
        const currentTotal = Math.max(0, rawCount + (existingAdjustment?.value || 0));

        setAdjustmentTarget({
            timestamp: canonicalTimestamp.toISOString(),
            sensorId: targetSensorId,
            currentAdjustment: existingAdjustment,
            rawCount,
            otherAdjustmentsValue,
            currentTotal
        });
        setIsAdjustmentModalOpen(true);
    };



    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <header className="bg-white shadow mb-8">
                <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Movement Mapper
                    </h1>
                    <div className="flex space-x-4">
                        <button
                            onClick={() => setIsSettingsModalOpen(true)}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded"
                        >
                            ⚙️
                        </button>
                    </div>
                </div>
            </header>

            <SettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                onGenerateDemo={generateDemoData}
                onClearDemo={clearDemoData}
                onFetchHistorical={() => axios.post('/api/logs/fetch-historical').then(() => fetchData())}
                demoLoading={demoLoading}
            />



            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* Sensors List */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Sensors</h2>
                        <div className="flex gap-2">
                            {/* Admin buttons moved to Settings */}
                        </div>
                    </div>
                    <div className="space-y-3">
                        {sensors.map(sensor => (
                            <div key={sensor.id} className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={selectedSensors.has(sensor.id)}
                                    onChange={() => toggleSensor(sensor.id)}
                                    className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <div>
                                    <div className="font-medium text-gray-900">{sensor.name}</div>
                                    <div className="text-xs text-gray-500">{sensor.type} • {sensor.unique_id}</div>
                                </div>
                            </div>
                        ))}
                        {sensors.length === 0 && <p className="text-gray-500 italic">No sensors found.</p>}
                    </div>
                </div>

                {/* Anomalies List */}


                {/* Heatmap Details Panel */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold mb-4">
                        {selectedHeatmapCell ? (
                            <>
                                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][selectedHeatmapCell.day]} at {selectedHeatmapCell.hour}:00
                                {filteredLogs.filter(log => {
                                    const d = new Date(log.timestamp);
                                    const dayMatch = d.getDay() === selectedHeatmapCell.day && d.getHours() === selectedHeatmapCell.hour;
                                    if (!dayMatch) return false;
                                    if (log.value !== 'active') return false;
                                    if (selectedHeatmapCell.date) {
                                        // Compare year, month, date
                                        return d.getFullYear() === selectedHeatmapCell.date.getFullYear() &&
                                            d.getMonth() === selectedHeatmapCell.date.getMonth() &&
                                            d.getDate() === selectedHeatmapCell.date.getDate();
                                    }
                                    if (log.value !== 'active') return false;
                                    return true;
                                }).length > 0 && (
                                        <div className="text-sm font-normal text-gray-600 mt-1">
                                            {(() => {
                                                const matchingLogs = filteredLogs.filter(log => {
                                                    const d = new Date(log.timestamp);
                                                    const dayMatch = d.getDay() === selectedHeatmapCell.day && d.getHours() === selectedHeatmapCell.hour;
                                                    if (!dayMatch) return false;
                                                    if (log.value !== 'active') return false;
                                                    if (selectedHeatmapCell.date) {
                                                        return d.getFullYear() === selectedHeatmapCell.date.getFullYear() &&
                                                            d.getMonth() === selectedHeatmapCell.date.getMonth() &&
                                                            d.getDate() === selectedHeatmapCell.date.getDate();
                                                    }
                                                    return true;
                                                });
                                                if (matchingLogs.length > 0) {
                                                    const dates = [...new Set(matchingLogs.map(log =>
                                                        new Date(log.timestamp).toLocaleDateString('en-US', {
                                                            weekday: 'long',
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric'
                                                        })
                                                    ))];
                                                    return dates.length === 1
                                                        ? dates[0]
                                                        : `${dates.length} dates: ${dates.join(', ')}`;
                                                }
                                                return '';
                                            })()}
                                        </div>
                                    )}
                            </>
                        ) : 'Heatmap Details'}
                    </h2>

                    {selectedHeatmapCell ? (
                        <div className="space-y-4">
                            <div className="space-y-2 h-72 overflow-y-auto">
                                {/* ... logs list ... */}
                                {filteredLogs
                                    .filter(log => {
                                        const d = new Date(log.timestamp);
                                        const dayMatch = d.getDay() === selectedHeatmapCell.day && d.getHours() === selectedHeatmapCell.hour;
                                        if (!dayMatch) return false;
                                        if (log.value !== 'active') return false;
                                        if (selectedHeatmapCell.date) {
                                            return d.getFullYear() === selectedHeatmapCell.date.getFullYear() &&
                                                d.getMonth() === selectedHeatmapCell.date.getMonth() &&
                                                d.getDate() === selectedHeatmapCell.date.getDate();
                                        }
                                        return true;
                                    })
                                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                                    .map(log => (
                                        <div key={log.id} className="p-2 border-b text-sm">
                                            <div className="font-medium">{new Date(log.timestamp).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                                            <div className="text-gray-600">{new Date(log.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}</div>
                                            <div className="text-gray-500">Sensor: {sensors.find(s => s.id === log.sensor_id)?.name || log.sensor_id}</div>
                                        </div>
                                    ))
                                }
                                {filteredLogs.filter(log => {
                                    const d = new Date(log.timestamp);
                                    const dayMatch = d.getDay() === selectedHeatmapCell.day && d.getHours() === selectedHeatmapCell.hour;
                                    if (!dayMatch) return false;
                                    if (log.value !== 'active') return false;
                                    if (selectedHeatmapCell.date) {
                                        return d.getFullYear() === selectedHeatmapCell.date.getFullYear() &&
                                            d.getMonth() === selectedHeatmapCell.date.getMonth() &&
                                            d.getDate() === selectedHeatmapCell.date.getDate();
                                    }
                                    return true;
                                }).length === 0 && (
                                        <p className="text-gray-500 italic">No events found for this time slot in the current view.</p>
                                    )}
                            </div>

                            {/* Adjustment Button in Details Panel */}
                            {!isAggregateMode ? (
                                <button
                                    onClick={() => {
                                        console.log('Adjust button clicked');
                                        console.log('Selected Cell:', selectedHeatmapCell);

                                        // If we have a specific date from the cell click, use it
                                        if (selectedHeatmapCell.date) {
                                            const targetDate = new Date(selectedHeatmapCell.date);
                                            targetDate.setHours(selectedHeatmapCell.hour, 0, 0, 0);
                                            console.log('Opening modal for specific date:', targetDate.toISOString());
                                            openAdjustmentModal(targetDate.toISOString());
                                            return;
                                        }

                                        // Fallback for aggregate or missing date (shouldn't happen in non-aggregate mode with new logic)
                                        const matchingLogs = filteredLogs.filter(log => {
                                            const d = new Date(log.timestamp);
                                            if (log.value !== 'active') return false;
                                            return d.getDay() === selectedHeatmapCell.day && d.getHours() === selectedHeatmapCell.hour;
                                        });

                                        console.log('Matching Logs:', matchingLogs.length);

                                        if (matchingLogs.length > 0) {
                                            // Use the most recent log's date (rounded to hour)
                                            const latest = new Date(Math.max(...matchingLogs.map(l => new Date(l.timestamp))));
                                            latest.setMinutes(0, 0, 0);
                                            console.log('Opening modal for:', latest.toISOString());
                                            openAdjustmentModal(latest.toISOString());
                                        } else {
                                            console.log('No matching logs found');
                                            // If no logs, we can't guess the date in aggregate mode easily, but in non-aggregate we should have selectedHeatmapCell.date
                                            alert("No data to adjust for this slot.");
                                        }
                                    }}
                                    className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded font-medium"
                                >
                                    Adjust Data for this Slot
                                </button>
                            ) : (
                                <div className="p-3 bg-gray-100 text-gray-500 text-center rounded text-sm italic">
                                    Adjustments are disabled in Aggregate Mode.
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-gray-500 italic">Select a cell in the heatmap to view details and make adjustments.</p>
                    )}
                </div>

                {/* View Controls Panel (New 3rd Column) */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold mb-4">View Controls</h2>
                    <div className="flex flex-col gap-6">
                        <div>
                            <div className="text-2xl font-bold text-gray-900 mb-1">{formatWeekRange()}</div>
                            <div className="text-sm text-gray-500">Current View Range</div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Weeks to View: {weeksToView}</label>
                            <input
                                type="range"
                                min="1"
                                max="12"
                                value={weeksToView}
                                onChange={(e) => setWeeksToView(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>1w</span>
                                <span>12w</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="aggregateMode"
                                    checked={isAggregateMode}
                                    onChange={(e) => setIsAggregateMode(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <label htmlFor="aggregateMode" className="text-sm font-medium text-gray-700">Aggregate Mode</label>
                            </div>

                            {isAggregateMode && (
                                <div className="flex items-center gap-2 ml-6">
                                    <input
                                        type="checkbox"
                                        id="sumMode"
                                        checked={isSumMode}
                                        onChange={(e) => setIsSumMode(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                    />
                                    <label htmlFor="sumMode" className="text-sm font-medium text-gray-700">Sum Mode</label>
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="excludeToday"
                                    checked={excludeToday}
                                    onChange={(e) => setExcludeToday(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <label htmlFor="excludeToday" className="text-sm font-medium text-gray-700">Exclude Today</label>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="excludeFirstDay"
                                    checked={excludeFirstDay}
                                    onChange={(e) => setExcludeFirstDay(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <label htmlFor="excludeFirstDay" className="text-sm font-medium text-gray-700">Exclude First Day</label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Time Travel</label>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Past</span>
                                <input
                                    type="range"
                                    min={minWeekOffset}
                                    max="0"
                                    value={weekOffset}
                                    onChange={(e) => setWeekOffset(parseInt(e.target.value))}
                                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-xs text-gray-500">Today</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Activity Heatmap - Full Width */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">Activity Heatmap</h2>
                <p className="text-sm text-gray-500 mb-2">Click a cell to view details</p>
                <Heatmap
                    logs={filteredLogs}
                    weekRanges={weekRanges}
                    isAggregateMode={isAggregateMode}
                    isSumMode={isSumMode}
                    onCellClick={handleHeatmapClick}
                    onCellHover={setHoveredCell}
                    hoveredCell={hoveredCell}
                    highlightedCriteria={highlightedCriteria}
                    adjustments={filteredAdjustments}
                />
            </div>


            <AdjustmentModal
                isOpen={isAdjustmentModalOpen}
                onClose={() => setIsAdjustmentModalOpen(false)}
                onSave={handleSaveAdjustment}
                onClear={adjustmentTarget?.currentAdjustment ? handleClearAdjustment : null}
                currentTotal={adjustmentTarget?.currentTotal || 0}
                originalValue={adjustmentTarget?.rawCount || 0}
                initialComment={adjustmentTarget?.currentAdjustment?.comment || ''}
                timestamp={adjustmentTarget?.timestamp}
                sensorName={adjustmentTarget?.sensorId ? sensors.find(s => s.id === adjustmentTarget.sensorId)?.name : 'All Sensors'}
            />

            <SettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
            />
        </div>
    );
}

export default App;
