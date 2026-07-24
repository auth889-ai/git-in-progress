import React from "react";

// GitHub-style achievements computed from real activity. Locked badges show
// how to earn them, so even a brand-new profile has visible progression.
const Achievements = ({ repositories, commits, starred }) => {
  const distinctRepos = new Set(commits.map((c) => c.repository)).size;
  const noBlocks =
    commits.length >= 5 && commits.every((c) => c.policyRisk?.verdict !== "BLOCK");

  const badges = [
    { icon: "🚀", name: "First Launch", hint: "Create your first repository", earned: repositories.length >= 1 },
    { icon: "✍️", name: "Committed", hint: "Make your first commit", earned: commits.length >= 1 },
    { icon: "📦", name: "Shipper", hint: "Reach 10 commits", earned: commits.length >= 10 },
    { icon: "🛡️", name: "Clean Record", hint: "5+ commits, zero BLOCK verdicts", earned: noBlocks },
    { icon: "🧭", name: "Explorer", hint: "Commit to 2 different repositories", earned: distinctRepos >= 2 },
    { icon: "🗂️", name: "Collector", hint: "Own 3 repositories", earned: repositories.length >= 3 },
    { icon: "⭐", name: "Curator", hint: "Star 3 repositories", earned: starred.length >= 3 },
  ];
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <section>
      <h3 className="profile-section-title">
        Achievements · {earnedCount}/{badges.length}
      </h3>
      <div className="achievement-grid">
        {badges.map((b) => (
          <div
            key={b.name}
            className={`achievement ${b.earned ? "earned" : "locked"}`}
            title={b.earned ? b.name : `Locked — ${b.hint}`}
          >
            <span className="achievement-icon">{b.icon}</span>
            <b>{b.name}</b>
            <span className="achievement-hint">{b.earned ? "Earned ✓" : b.hint}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Achievements;
