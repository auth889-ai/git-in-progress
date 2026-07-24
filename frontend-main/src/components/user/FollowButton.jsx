import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../config";

// Follow/unfollow another user. Hidden on your own content or when logged out.
const FollowButton = ({ targetId, targetName }) => {
  const me = localStorage.getItem("userId");
  const [following, setFollowing] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me || !targetId || String(me) === String(targetId)) return;
    axios
      .get(`${API_URL}/userProfile/${me}`)
      .then((res) =>
        setFollowing(
          (res.data.followedUsers || []).some((id) => String(id) === String(targetId))
        )
      )
      .catch(() => setFollowing(false));
  }, [me, targetId]);

  if (!me || !targetId || String(me) === String(targetId) || following === null)
    return null;

  const toggle = async () => {
    try {
      setBusy(true);
      const res = await axios.patch(`${API_URL}/follow/${targetId}`);
      setFollowing(res.data.following);
    } catch (err) {
      console.error("Follow failed:", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      className={`btn follow-btn ${following ? "following" : ""}`}
      disabled={busy}
      onClick={toggle}
      title={following ? `Unfollow ${targetName}` : `Follow ${targetName}`}
    >
      {busy ? "…" : following ? "✓ Following" : "+ Follow"}
    </button>
  );
};

export default FollowButton;
