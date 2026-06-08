import { useEffect, useRef, useState } from 'react';

import { IconVolume, IconVolumeOff } from '@tabler/icons-react';

import classes from './PostVideo.module.css';

type PostVideoProps = {
  src: string;
  maxHeight?: number;
};

// Inline video, Threads-style: autoplays muted and loops (so it reads like a
// gif), with a mute/unmute toggle bottom-right that also signals "this is a
// video with sound, not a gif". Muted autoplay is the only kind browsers allow.
export function PostVideo({ src, maxHeight = 500 }: PostVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  // React doesn't reliably set the `muted` *property* (only the attribute), which
  // some browsers need before they'll autoplay — set it on the element directly.
  useEffect(() => {
    if (ref.current) ref.current.muted = true;
  }, []);

  const toggleMute = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const video = ref.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    // Unmuting after an autoplay can leave it paused in some browsers.
    if (!video.muted) void video.play();
  };

  return (
    <div className={classes.wrap} onClick={(e) => e.stopPropagation()}>
      <video
        ref={ref}
        src={src}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className={classes.video}
        style={{ maxHeight }}
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
