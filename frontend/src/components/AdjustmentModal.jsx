import React, { useState, useEffect } from 'react';

const AdjustmentModal = ({ isOpen, onClose, onSave, onClear, currentTotal = 0, originalValue = 0, initialComment = '', timestamp, sensorName }) => {
    const [value, setValue] = useState(currentTotal);
    const [comment, setComment] = useState(initialComment);

    useEffect(() => {
        if (isOpen) {
            setValue(currentTotal);
            setComment(initialComment);
        }
    }, [isOpen, currentTotal, initialComment]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(parseInt(value), comment);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-[500px] h-[600px] shadow-xl flex flex-col">
                <div className="flex-1 overflow-y-auto">
                    <div className="text-lg font-semibold mb-4">
                        {new Date(timestamp).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })} at {new Date(timestamp).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                        })}
                    </div>

                    <div className="mb-4 text-sm text-gray-600">
                        {sensorName && <p><strong>Sensor:</strong> {sensorName}</p>}
                        <p className="mt-2"><strong>Original Value:</strong> {originalValue}</p>
                        <p className="mt-1"><strong>Current Value:</strong> {currentTotal}</p>
                    </div>

                    <form onSubmit={handleSubmit} id="adjustment-form">
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                New Total Value
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g. 10"
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Enter the correct total count for this slot.
                            </p>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Comment (Required)
                            </label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                rows="3"
                                placeholder="Reason for adjustment..."
                                required
                            />
                        </div>
                    </form>
                </div>

                <div className="mt-auto pt-4 border-t flex justify-between items-center">
                    {onClear && (
                        <button
                            type="button"
                            onClick={onClear}
                            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded border border-red-200 hover:border-red-300"
                        >
                            Clear Adjustments
                        </button>
                    )}
                    <div className="flex gap-2 ml-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="adjustment-form"
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            Save Adjustment
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdjustmentModal;
