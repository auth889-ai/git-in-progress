import React from "react";
import HeatMap from "@uiw/react-heat-map";

// Violet contribution scale to match the premium light theme
const PANEL_COLORS = {
  0: "#eef0f6",
  1: "#ddd6fe",
  3: "#a78bfa",
  6: "#8b5cf6",
  10: "#6d28d9",
};

// Aggregate raw ISO timestamps into { date, count } per day
function buildActivity(timestamps) {
  const counts = {};
  for (const ts of timestamps) {
    if (!ts) continue;
    const day = new Date(ts).toISOString().split("T")[0].replace(/-/g, "/");
    counts[day] = (counts[day] || 0) + 1;
  }
  return Object.entries(counts).map(([date, count]) => ({ date, count }));
}

const HeatMapProfile = ({ timestamps = [] }) => {
  const activityData = buildActivity(timestamps);

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 6);

  const total = timestamps.filter(Boolean).length;

  return (
    <div>
      <h4 style={{ marginBottom: 12 }}>
        {total} contribution{total === 1 ? "" : "s"} in the last 6 months
      </h4>
      <HeatMap
        className="HeatMapProfile"
        style={{ width: "100%", color: "#64748b" }}
        value={activityData}
        weekLabels={["", "Mon", "", "Wed", "", "Fri", ""]}
        startDate={startDate}
        endDate={new Date()}
        rectSize={12}
        space={3}
        rectProps={{ rx: 2 }}
        panelColors={PANEL_COLORS}
      />
    </div>
  );
};

export default HeatMapProfile;
