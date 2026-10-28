import React from "react";
import { Plus } from "lucide-react";
import { useConfig } from "../../context/ConfigContext";
import { useDevice } from "../../context/DeviceContext";
import { useSettings } from "../../context/SettingsContext";
import ProfileContainer from "../tabs/ProfileContainer";
const ProfileManagerTab = () => {
  const { data, addConfigItem } = useConfig();
  const { status } = useDevice();
  const { isAdvanced } = useSettings();

  if (!data) return null;

  const filteredData = () => {
    if (isAdvanced) {
      return data?.profiles?.map((_, index) => index);
    } else {
      return [status?.conIdx ?? 0];
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      {isAdvanced && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "1rem",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "large" }}>Profiles</h3>
          <button
            className="btn btn-primary"
            onClick={() => addConfigItem(["profiles"])}
          >
            <Plus size={16} />
            Add Profile
          </button>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "row", gap: "1rem" }}>
        {filteredData()?.filter((i) => data.profiles[i]).map((profileIdx) => (
          <ProfileContainer
            key={profileIdx}
            index={profileIdx}
            data={data.profiles[profileIdx]}
          />
        ))}
      </div>

      {data.profiles.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "2rem",
            color: "var(--text-sub)",
          }}
        >
          No profiles found. Click "Add Profile" to create one.
        </div>
      )}
    </div>
  );
};
export default ProfileManagerTab;
