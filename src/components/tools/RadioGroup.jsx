import React, { useState } from 'react';
import { VStack  } from '../ui/Utility';

function RadioGroup({ choices, setChoice }) {
  // 1. Set up the state for the selected option
  const [selectedOption, setSelectedOption] = useState(0); // Default to the first option

  // 2. Handle the change event
  const handleOptionChange = (event) => {
    setSelectedOption(event.target.value);
    setChoice(choices[event.target.value]); // Pass the selected choice's id to the parent component
  };

  return (    <form >
      {/* 3. Group the radio buttons with the same name and use state for control */}
      <VStack style={{ gap: "0.5rem", justifyContent: "flex-start", alignItems: "flex-start", flexDirection: "column"}}>
        {choices.map((choice, index) => (
          <label key={index}>
            <input
              type="radio"
              name="options" // Same name groups them
              value={index} // Value can be the index or a unique identifier
              checked={selectedOption == index} // Checked based on state
              onChange={handleOptionChange}
            />
            {choice.name.replace(/\.[^.]+$/, "")} {/* Display name without extension */}
          </label>
        ))}
      </VStack>
    </form>
  );
}

export default RadioGroup;