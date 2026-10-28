import { useId, useState } from "react";
import { VStack } from "../ui/Utility";

interface RadioGroupProps<T extends { name: string }> {
  choices: T[];
  setChoice: (choice: T) => void;
}

/** One radio per choice, labelled by its name without the file extension. */
function RadioGroup<T extends { name: string }>({ choices, setChoice }: RadioGroupProps<T>) {
  const [selected, setSelected] = useState(0); // Default to the first option
  const groupName = useId();

  return (
    <form>
      <VStack style={{ gap: "0.5rem", justifyContent: "flex-start", alignItems: "flex-start" }}>
        {choices.map((choice, index) => (
          <label key={index}>
            <input
              type="radio"
              name={groupName}
              value={index}
              checked={selected === index}
              onChange={() => {
                setSelected(index);
                setChoice(choice);
              }}
            />
            {choice.name.replace(/\.[^.]+$/, "")}
          </label>
        ))}
      </VStack>
    </form>
  );
}

export default RadioGroup;
