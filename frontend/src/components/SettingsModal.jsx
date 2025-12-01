import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SettingsModal = ({ isOpen, onClose, onGenerateDemo, onClearDemo, onFetchHistorical, demoLoading, onRefreshData }) => {
    console.log('SettingsModal props:', { onGenerateDemo, onClearDemo, onFetchHistorical });

    const [ip, setIp] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [showLogs, setShowLogs] = useState(false);
    const [logs, setLogs] = useState('');
    const [logsLoading, setLogsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [status, setStatus] = useState(null);
    const [sensors, setSensors] = useState([]);
    const [originalSensors, setOriginalSensors] = useState([]);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchConfig();
            fetchStatus();
            fetchSensors();
            setShowLogs(false); // Reset logs view when opening modal
        }
    }, [isOpen]);

    const fetchSensors = async () => {
        try {
            const response = await axios.get('/api/sensors');
            setSensors(response.data);
            setOriginalSensors(JSON.parse(JSON.stringify(response.data))); // Deep copy
            setHasChanges(false);
        } catch (error) {
            console.error('Error fetching sensors:', error);
        }
    };

    const handleCancel = () => {
        // Revert all sensor changes
        setSensors(JSON.parse(JSON.stringify(originalSensors)));
        setHasChanges(false);
        onClose();
    };

    const handleOk = async () => {
        if (hasChanges) {
            // Apply all changes
            try {
                for (const sensor of sensors) {
                    const original = originalSensors.find(s => s.id === sensor.id);
                    if (original && original.is_hidden !== sensor.is_hidden) {
                        await axios.patch(`/api/sensors/${sensor.id}`, {
                            is_hidden: sensor.is_hidden
                        });
                    }
                }
                if (onRefreshData) {
                    await onRefreshData();
                }
                setHasChanges(false);
            } catch (error) {
                console.error('Error saving sensor changes:', error);
                setMessage({ type: 'error', text: 'Failed to save sensor changes' });
                return;
            }
        }
        onClose();
    };

    const fetchStatus = async () => {
        try {
            const response = await axios.get('/api/status');
            setStatus(response.data);
        } catch (error) {
            console.error('Error fetching status:', error);
        }
    };

    const fetchConfig = async () => {
        try {
            const response = await axios.get('/api/config');
            const data = response.data;
            setIp(data.tapo_ip || '');
            setUsername(data.tapo_username || '');
            setPassword(data.tapo_password || ''); // Will be masked
        } catch (error) {
            console.error('Error fetching config:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            await axios.post('/api/config', {
                tapo_ip: ip,
                tapo_username: username,
                tapo_password: password,
            });

            setMessage({ type: 'success', text: 'Configuration saved. Client restarting...' });
            setTimeout(() => {
                onClose();
                setMessage(null);
            }, 2000);
        } catch (error) {
            console.error('Error saving config:', error);
            setMessage({ type: 'error', text: 'Error saving configuration.' });
        } finally {
            setLoading(false);
        }
    };

    const handleRefreshSensors = async () => {
        setRefreshing(true);
        setMessage(null);
        try {
            const response = await axios.post('/api/sensors/refresh');
            setMessage({ type: 'success', text: response.data.message });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Error refreshing sensors:', error);
            setMessage({ type: 'error', text: 'Error refreshing sensors: ' + (error.response?.data?.detail || error.message) });
        } finally {
            setRefreshing(false);
        }
    };

    const handleDisplayLogs = async () => {
        setLogsLoading(true);
        try {
            const response = await axios.get('/api/logs/backend?lines=1000');
            setLogs(response.data.logs);
            setShowLogs(true);
        } catch (error) {
            console.error('Error fetching logs:', error);
            setMessage({ type: 'error', text: 'Error fetching logs.' });
        } finally {
            setLogsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-[800px] shadow-xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4 text-gray-800">Tapo Hub Settings</h2>

                {status && status.error && (
                    <div className="mb-4 p-3 rounded bg-red-100 border border-red-400 text-red-700 text-sm">
                        <strong>Connection Error:</strong> {status.error}
                    </div>
                )}

                {message && (
                    <div className={`mb-4 p-2 rounded ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {message.text}
                    </div>
                )}

                {!showLogs ? (
                    <>
                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">
                                    Hub IP Address
                                </label>
                                <input
                                    type="text"
                                    value={ip}
                                    onChange={(e) => setIp(e.target.value)}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    placeholder="192.168.0.100"
                                    required
                                />
                            </div>

                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">
                                    Username (Email)
                                </label>
                                <input
                                    type="email"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    placeholder="user@example.com"
                                    required
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-gray-700 text-sm font-bold mb-2">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    placeholder="********"
                                    required
                                />
                            </div>

                            <div className="flex justify-end space-x-2 mb-6">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                    disabled={loading}
                                >
                                    {loading ? 'Saving...' : 'Save & Connect'}
                                </button>
                            </div>
                        </form>

                        <hr className="my-4 border-gray-200" />

                        <div className="mt-4">
                            <h3 className="text-lg font-semibold mb-3 text-gray-800">Sensor Management</h3>
                            <div className="flex flex-col gap-2 mb-4">
                                <button
                                    onClick={handleRefreshSensors}
                                    disabled={refreshing}
                                    className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 text-sm font-medium"
                                >
                                    {refreshing ? 'Refreshing...' : 'Refresh Sensors'}
                                </button>
                            </div>
                        </div>

                        <hr className="my-4 border-gray-200" />

                        <div className="mt-4">
                            <h3 className="text-lg font-semibold mb-3 text-gray-800">Sensor Visibility</h3>
                            <p className="text-sm text-gray-600 mb-3">Check the sensors you want to display on the main screen</p>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {sensors.length > 0 ? (
                                    sensors.map(sensor => (
                                        <div key={sensor.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                                            <input
                                                type="checkbox"
                                                checked={!sensor.is_hidden}
                                                onChange={(e) => {
                                                    // Update local state only
                                                    setSensors(prevSensors =>
                                                        prevSensors.map(s =>
                                                            s.id === sensor.id
                                                                ? { ...s, is_hidden: !e.target.checked }
                                                                : s
                                                        )
                                                    );
                                                    setHasChanges(true);
                                                }}
                                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                            />
                                            <div className="flex-1">
                                                <div className="font-medium text-gray-900">{sensor.name}</div>
                                                <div className="text-xs text-gray-500">{sensor.type}</div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-500 italic text-sm">No sensors available</p>
                                )}
                            </div>
                        </div>

                        <hr className="my-4 border-gray-200" />

                        <div className="mt-4">
                            <h3 className="text-lg font-semibold mb-3 text-gray-800">Data Management</h3>
                            <div className="flex gap-2 mb-2">
                                <button
                                    onClick={async () => {
                                        try {
                                            await onGenerateDemo();
                                            // Wait a moment for the backend to finish writing
                                            await new Promise(resolve => setTimeout(resolve, 1000));
                                            await fetchSensors();
                                        } catch (error) {
                                            console.error('Error in demo generation:', error);
                                        }
                                    }}
                                    disabled={demoLoading}
                                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
                                >
                                    {demoLoading ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Generating...
                                        </>
                                    ) : 'Generate Demo Data'}
                                </button>
                                <button
                                    onClick={async () => {
                                        try {
                                            await onClearDemo();
                                            // Wait a moment for the backend to finish
                                            await new Promise(resolve => setTimeout(resolve, 500));
                                            await fetchSensors();
                                        } catch (error) {
                                            console.error('Error in demo clearing:', error);
                                        }
                                    }}
                                    disabled={demoLoading}
                                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 text-sm font-medium"
                                >
                                    Clear Demo Data
                                </button>
                            </div>
                            <button
                                onClick={onFetchHistorical}
                                className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm font-medium"
                            >
                                Fetch Historical Data
                            </button>
                        </div>

                        <hr className="my-4 border-gray-200" />

                        <div className="mt-4">
                            <h3 className="text-lg font-semibold mb-3 text-gray-800">Diagnostics</h3>
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={handleDisplayLogs}
                                    disabled={logsLoading}
                                    className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 text-sm font-medium"
                                >
                                    {logsLoading ? 'Loading...' : 'Display Logs'}
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">Backend Logs</h3>
                            <button
                                onClick={() => setShowLogs(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ← Back
                            </button>
                        </div>
                        <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                            {logs}
                        </pre>
                    </div>
                )}

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
                    <button
                        onClick={handleCancel}
                        className="px-6 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleOk}
                        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
