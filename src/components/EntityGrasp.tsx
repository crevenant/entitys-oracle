import type { RitualPhase } from '../lib/ritual'

function Claw() {
  return <svg viewBox="0 0 185 310" fill="none">
    <path className="tendril-body" d="M0 300C39 266 22 230 72 225 104 222 96 177 129 162 147 154 153 140 151 116 150 95 167 79 183 74 161 97 167 116 165 135 163 164 145 179 133 188 114 204 126 232 92 246 52 262 58 287 13 310Z" />
    <path className="tendril-body" d="M54 243 35 211 73 228ZM92 222 83 185 111 198ZM129 183 116 150 143 159ZM156 144C139 128 140 101 158 88L153 117 169 126ZM35 278 13 252 46 260Z" />
    <path className="tendril-highlight" d="M12 299C52 268 34 242 81 236S105 185 139 174 143 112 169 90" />
    <path className="tendril-vein" d="M22 295C61 261 44 247 86 230S111 181 143 168 148 123 167 105" />
    <path className="tendril-hook" d="M133 188C164 179 175 158 171 140 169 129 176 119 185 116 173 137 184 151 177 165 168 183 150 191 133 197Z" />
  </svg>
}

export default function EntityGrasp({ phase }: { phase: RitualPhase }) {
  return <div className={`entity-grasp grasp-${phase}`} aria-hidden="true"><div className="grasp-arm grasp-left"><Claw /></div><div className="grasp-arm grasp-right"><Claw /></div></div>
}
