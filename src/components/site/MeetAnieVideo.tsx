type MeetAnieVideoProps = {
  className?: string;
  poster?: string;
};

const INTRO_SRC = "/media/meet-anie-intro.mp4";
const INTRO_POSTER = "/media/meet-anie-intro.jpg";

export function MeetAnieVideo({ className = "", poster }: MeetAnieVideoProps) {
  return (
    <div className={`media-frame aspect-[9/16] overflow-hidden ${className}`.trim()}>
      <video
        className="h-full w-full object-cover"
        src={INTRO_SRC}
        poster={poster || INTRO_POSTER}
        controls
        playsInline
        preload="metadata"
        aria-label="Meet Anie intro video"
      >
        <a href={INTRO_SRC}>Watch intro video</a>
      </video>
    </div>
  );
}
