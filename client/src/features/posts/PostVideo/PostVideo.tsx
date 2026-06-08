import { useEffect, useRef, useState } from 'react';

import { IconVolume, IconVolumeOff } from '@tabler/icons-react';

import classes from './PostVideo.module.css';

type PostVideoProps = {
  src: string;
  maxHeight?: number;
  // Fixed height (px) for carousel slides: the video sizes to this height with
  // its width following the aspect ratio. Takes precedence over maxHeight.
  height?: number;
  // When set, clicking the video (not the mute button) opens it — used to expand
  // into a full-browser-window viewer. Omitted in the composer preview.
  onExpand?: () => void;
};

// Inline video, Threads-style: plays muted and loops while on screen (so it
// reads like a gif), pauses when scrolled out of view, and has a mute/unmute
// toggle bottom-right that also signals "this is a video with sound, not a gif".
export function PostVideo({
  src,
  maxHeight = 500,
  height,
  onExpand,
}: PostVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  // React doesn't reliably set the `muted` *property* (only the attribute), which
  // browsers need before they'll play muted without a gesture.
  useEffect(() => {
    if (ref.current) ref.current.muted = true;
  }, []);

  // Play only while visible — keeps off-screen videos from running in the feed.
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: 0.5 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, []);

  const toggleMute = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const video = ref.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    if (!video.muted) void video.play().catch(() => undefined);
  };

  return (
    <div
      className={classes.wrap}
      // Don't let a click bubble to the post (which navigates on click).
      onClick={(e) => e.stopPropagation()}
    >
      <video
        ref={ref}
        src={src}
        loop
        muted
        playsInline
        preload="metadata"
        className={classes.video}
        // Size to the video's own aspect ratio (height-driven, width auto) so
        // portrait videos don't get black letterbox bars. The wrap shrinks to
        // match, keeping the mute button on the video's edge.
        style={{
          ...(height ? { height } : { maxHeight }),
          cursor: onExpand ? 'pointer' : undefined,
        }}
        onClick={onExpand}
      />
      <button
        type="button"
        className={classes.muteButton}
        onClick={toggleMute}
        aria-label={muted ? 'Unmute video' : 'Mute video'}
      >
        {muted ? <IconVolumeOff size={16} /> : <IconVolume size={16} />}
      </button>
    </div>
  );
}
