export const MEET_ANIE_INTRO_SRC = "/media/meet-anie-intro.mp4";
export const MEET_ANIE_INTRO_POSTER = "/media/meet-anie-intro.jpg";

type MeetAnieVideoProps = {
  className?: string;
  poster?: string;
};

export function MeetAnieVideo({ className = "", poster }: MeetAnieVideoProps) {
  return (
    <div className={`media-frame aspect-[9/16] overflow-hidden ${className}`.trim()}>
      <video
        className="h-full w-full object-cover"
        src={MEET_ANIE_INTRO_SRC}
        poster={poster || MEET_ANIE_INTRO_POSTER}
        controls
        playsInline
        preload="metadata"
        aria-label="Meet Anie intro video"
      >
        <a href={MEET_ANIE_INTRO_SRC}>Watch intro video</a>
      </video>
    </div>
  );
}
