import mark from '../assets/Tutor-Studio-mark.png';

/** Full-screen animated loader. Styles live in index.html so the same screen shows before JS loads. */
export default function LoadingScreen() {
  return (
    <div className="ts-splash" role="status" aria-label="Loading">
      <img className="ts-splash__mark" src={mark} alt="" />
      <div className="ts-splash__dots">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
