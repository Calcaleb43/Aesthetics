type StudioMapProps = {
  address: string;
  className?: string;
};

export function buildMapsSearchUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function buildMapsEmbedUrl(address: string) {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`;
}

export function buildMapsDirectionsUrl(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export function StudioMap({ address, className = "" }: StudioMapProps) {
  const embedUrl = buildMapsEmbedUrl(address);
  const mapsUrl = buildMapsSearchUrl(address);
  const directionsUrl = buildMapsDirectionsUrl(address);

  return (
    <div className={className}>
      <div className="overflow-hidden border border-black/10 bg-[var(--bg-deep)]">
        <iframe
          title={`Map showing ${address}`}
          src={embedUrl}
          className="h-[min(62vh,520px)] w-full border-0 grayscale-[20%] contrast-[1.05]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <a href={directionsUrl} target="_blank" rel="noreferrer" className="btn btn-gold">
          Get directions
        </a>
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn">
          Open in Google Maps
        </a>
      </div>
    </div>
  );
}
