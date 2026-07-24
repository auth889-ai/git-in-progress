import React from "react";
import HeatMap from "@uiw/react-heat-map";

// Violet contribution scale to match the premium light theme
const PANEL_COLORS = {
  0: "#e6eee7",
  1: "#c3e2cf",
  3: "#79b98f",
  6: "#3f8f68",
  10: "#245c41",
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
        style={{ width: "100%", color: "#5c6f62" }}
        value={activityData}
        weekLabels={["", "Mon", "", "Wed", "", "Fri", ""]}
        startDate={startDate}
        endDate={new Date()}
        rectSize={12}
        space={3}
        rectProps={{ rx: 2 }}
        rectRender={(props, data) => (
          <rect {...props}>
            <title>{`${data.date}: ${data.count || 0} contribution${(data.count || 0) === 1 ? "" : "s"}`}</title>
          </rect>
        )}
        panelColors={PANEL_COLORS}
      />
    </div>
  );
};

export default HeatMapProfile;
