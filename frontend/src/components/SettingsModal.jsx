import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SettingsModal = ({ isOpen, onClose, onGenerateDemo, onClearDemo, onFetchHistorical, demoLoading }) => {
    const [ip, setIp] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchConfig();
        }
    }, [isOpen]);

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96 shadow-xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4 text-gray-800">Tapo Hub Settings</h2>

                {message && (
                    <div className={`mb-4 p-2 rounded ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {message.text}
                    </div>
                )}

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
                    <h3 className="text-lg font-semibold mb-3 text-gray-800">Data Management</h3>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={onGenerateDemo}
                            disabled={demoLoading}
                            className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 text-sm font-medium"
                        >
                            {demoLoading ? 'Generating...' : 'Generate Demo Data'}
                        </button>
                        <button
                            onClick={onClearDemo}
                            disabled={demoLoading}
                            className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 text-sm font-medium"
                        >
                            Clear Demo Data
                        </button>
                        <button
                            onClick={onFetchHistorical}
                            className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm font-medium"
                        >
                            Fetch Historical Data
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
