import { ConfigProvider } from "./context/ConfigProvider";
import { DeviceProvider } from "./context/DeviceProvider";
import { DialogProvider } from "./context/DialogProvider";
import { SettingsProvider } from "./context/SettingsProvider";
import PwaUpdater from "./components/ui/PwaUpdater";
import Shell from "./components/ui/Shell";
import Toaster from "./components/ui/Toaster";

const App = () => (
  <SettingsProvider>
    <DeviceProvider>
      <ConfigProvider>
        <DialogProvider>
          <Shell />
          <Toaster />
          <PwaUpdater />
        </DialogProvider>
      </ConfigProvider>
    </DeviceProvider>
  </SettingsProvider>
);

export default App;
