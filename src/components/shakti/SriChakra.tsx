// Keep the source replaceable without changing the scene animation.
const CHAKRA_ASSET = "/images/sri-chakra.svg";

export function SriChakra() {
  return (
    <div className="shakti-chakra" aria-hidden="true">
      <img
        src={CHAKRA_ASSET}
        alt=""
        decoding="async"
        onError={(event) => {
          event.currentTarget.style.visibility = "hidden";
        }}
      />
    </div>
  );
}
