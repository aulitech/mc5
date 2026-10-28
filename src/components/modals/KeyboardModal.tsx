import { useState, useRef } from "react";
import Keyboard, { type SimpleKeyboard } from "react-simple-keyboard";
import "./KeyboardModal.css";

interface KeyboardModalProps {
  /** Called with the held modifiers, plus the pressed key last (if any). */
  onPress: (keys: string[]) => void;
}

const SHIFT_KEYS = ["{shift}", "{shiftleft}", "{shiftright}", "{capslock}"];
const MODIFIER_KEYS = [
  ...SHIFT_KEYS,
  "{control}",
  "{alt}",
  "{meta}",
  "{controlleft}",
  "{controlright}",
  "{altleft}",
  "{altright}",
  "{metaleft}",
  "{metaright}",
];

const KeyboardModal = ({ onPress }: KeyboardModalProps) => {
  const [state, setState] = useState({
    layoutName: "default",
    capsLock: false,
  });
  const modifiers = useRef<string[]>([]);
  const keyboard = useRef<SimpleKeyboard | null>(null);

  const commonKeyboardOptions = {
    onKeyPress: (button: string) => onKeyPress(button),
    theme: "simple-keyboard hg-theme-default hg-layout-default",
    physicalKeyboardHighlight: true,
    syncInstanceInputs: true,
    mergeDisplay: true,
    debug: false,
  };

  const keyboardOptions = {
    ...commonKeyboardOptions,

    layout: {
      default: [
        "{escape} {f1} {f2} {f3} {f4} {f5} {f6} {f7} {f8} {f9} {f10} {f11} {f12}",
        "` 1 2 3 4 5 6 7 8 9 0 - = {backspace}",
        "{tab} q w e r t y u i o p [ ] \\",
        "{capslock} a s d f g h j k l ; ' {enter}",
        "{shiftleft} z x c v b n m , . / {shiftright}",
        "{controlleft} {altleft} {metaleft} {space} {metaright} {altright} {controlright}",
      ],
      shift: [
        "{escape} {f1} {f2} {f3} {f4} {f5} {f6} {f7} {f8} {f9} {f10} {f11} {f12}",
        "~ ! @ # $ % ^ & * ( ) _ + {backspace}",
        "{tab} Q W E R T Y U I O P { } |",
        '{capslock} A S D F G H J K L : " {enter}',
        "{shiftleft} Z X C V B N M < > ? {shiftright}",
        "{controlleft} {altleft} {metaleft} {space} {metaright} {altright} {controlright}",
      ],
    },
    display: {
      "{escape}": "esc",
      "{tab}": "⇥",
      "{backspace}": "⌫",
      "{enter}": "↵",
      "{capslock}": "⇪",
      "{shiftleft}": "⇧",
      "{shiftright}": "⇧",
      "{controlleft}": "⌃",
      "{controlright}": "⌃",
      "{altleft}": "⌥",
      "{altright}": "⌥",
      "{metaleft}": "⌘",
      "{metaright}": "⌘",
    },
  };

  const keyboardControlPadOptions = {
    ...commonKeyboardOptions,
    layout: {
      default: [
        "{prtscr} {scrolllock} {pause}",
        "{insert} {home} {pageup}",
        "{delete} {end} {pagedown}",
      ],
    },
    display: {
      "{pageup}": "PgUp",
      "{pagedown}": "PgDn",
    },
  };

  const keyboardArrowsOptions = {
    ...commonKeyboardOptions,
    layout: {
      default: ["{arrowup}", "{arrowleft} {arrowdown} {arrowright}"],
    },
  };

  const keyboardNumPadOptions = {
    ...commonKeyboardOptions,
    layout: {
      default: [
        "{numlock} {numpaddivide} {numpadmultiply}",
        "{numpad7} {numpad8} {numpad9}",
        "{numpad4} {numpad5} {numpad6}",
        "{numpad1} {numpad2} {numpad3}",
        "{numpad0} {numpaddecimal}",
      ],
    },
  };

  const keyboardNumPadEndOptions = {
    ...commonKeyboardOptions,
    layout: {
      default: ["{numpadsubtract}", "{numpadadd}", "{numpadenter}"],
    },
    display: {
      "{numpadenter}": "↵",
    },
  };

  const onKeyPress = (button: string) => {
    if (MODIFIER_KEYS.includes(button)) {
      if (modifiers.current.includes(button)) {
        modifiers.current = modifiers.current.filter((mod) => mod !== button);
        keyboard.current?.removeButtonTheme(button, "hg-selectedButton");
      } else {
        modifiers.current.push(button);
        keyboard.current?.addButtonTheme(button, "hg-selectedButton");
      }
      if (SHIFT_KEYS.includes(button)) {
        setState((prev) => ({
          layoutName: prev.layoutName === "default" ? "shift" : "default",
          capsLock: button === "{capslock}" ? !prev.capsLock : prev.capsLock,
        }));
      }
      onPress([...modifiers.current]); // Send modifiers as input
    } else {
      onPress([...modifiers.current, button.toLowerCase()]); // Send modifiers and key as input
      modifiers.current.forEach((mod) => {
        keyboard.current?.removeButtonTheme(mod, "hg-selectedButton");
      });
      modifiers.current = []; // Clear modifiers after save
      setState((prev) => (prev.capsLock ? prev : { ...prev, layoutName: "default" }));
    }
  };

  return (
    <div>
      <div className="keyboardContainer">
        <Keyboard
          baseClass="simple-keyboard-main"
          keyboardRef={(r: SimpleKeyboard) => (keyboard.current = r)}
          layoutName={state.layoutName}
          {...keyboardOptions}
        />

        <div className="controlArrows">
          <Keyboard
            baseClass="simple-keyboard-control"
            {...keyboardControlPadOptions}
          />
          <Keyboard
            baseClass="simple-keyboard-arrows"
            {...keyboardArrowsOptions}
          />
        </div>

        <div className="numPad">
          <Keyboard
            baseClass="simple-keyboard-numpad"
            {...keyboardNumPadOptions}
          />
          <Keyboard
            baseClass="simple-keyboard-numpadEnd"
            {...keyboardNumPadEndOptions}
          />
        </div>
      </div>
    </div>
  );
};
export default KeyboardModal;
