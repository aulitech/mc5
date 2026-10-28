import React, { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

export const NumberSpinner = ({
	value,
	onChange,
	min = 0,
	max = 100,
	step = 1,
}) => {
	// Local state allows typing "0.5" without React snapping it back to "0" instantly
	const [localInputValue, setLocalInputValue] = useState(null);

	// Calculate precision based on step (e.g. step 0.1 -> 1 decimal place)
	const precision = step.toString().split(".")[1]?.length || 0;

	const commitValue = (val) => {
		let safeValue = Number(val.toFixed(precision));
		if (safeValue > max) safeValue = max;
		if (safeValue < min) safeValue = min;
		onChange(safeValue);
	};

	const handleIncrement = () => commitValue(value + step);
	const handleDecrement = () => commitValue(value - step);

	const handleInputChange = (e) => {
		const val = e.target.value;
		setLocalInputValue(val);

		if (val === "" || val === "-") return;
		const num = parseFloat(val);
		if (!isNaN(num)) {
			commitValue(num);
		}
	};

	const handleBlur = () => {
		setLocalInputValue(null); // Re-sync with parent prop on blur
	};

	const displayValue =
		localInputValue !== null ? localInputValue : String(value);

	return (
		<div
			className="custom-spinner-wrapper"
			style={{ width: "100%" }}
		>
			<input
				type="text"
				inputMode="numeric"
				pattern="[0-9]*"
				className="input-base spinner-input input-number-no-spin"
				style={{ minWidth: "4rem", textAlign: "right" }} // Override width for full container fill
				value={displayValue}
				onChange={handleInputChange}
				onBlur={handleBlur}
			/>
			<div className="spinner-btns">
				<button
					type="button"
					className="btn-spin"
					onClick={handleIncrement}
				>
					<ChevronUp size={12} />
				</button>
				<button
					type="button"
					className="btn-spin"
					onClick={handleDecrement}
				>
					<ChevronDown size={12} />
				</button>
			</div>
		</div>
	);
};
