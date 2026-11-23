import {
  attributeKeys,
  attributeLabels,
  overallRating,
  roleWeights,
  skillKeys,
  skillLabels,
  sourceLabels,
  type PlayerProfile,
  type ProfileResolution,
} from '@/pages/match-simulation';

type RatingKey = keyof PlayerProfile['skills'] | keyof PlayerProfile['attributes'];
const labelOf = (key: RatingKey) => (key in skillLabels ? skillLabels[key as keyof typeof skillLabels] : attributeLabels[key as keyof typeof attributeLabels]);
const tier = (value: number) => (value >= 75 ? 'high' : value >= 50 ? 'mid' : 'low');

/** Mocne i słabe strony spośród umiejętności, które liczą się na pozycji zawodnika. */
function strengths(profile: PlayerProfile) {
  const relevant = (Object.keys(roleWeights[profile.positions.primary]) as RatingKey[])
    .map(key => ({ key, value: key in profile.skills ? profile.skills[key as keyof PlayerProfile['skills']] : profile.attributes[key as keyof PlayerProfile['attributes']] }))
    .sort((a, b) => b.value - a.value);
  return { strong: relevant.slice(0, 2), weak: relevant.slice(-2).reverse() };
}

function Bar({ label, value, source }: { label: string; value: number; source: string }) {
  const isDefault = source === 'role_default';
  return (
    <div className={`sim-bar ${isDefault ? 'is-default' : ''}`} title={`${label}: ${value} — ${sourceLabels[source as keyof typeof sourceLabels]}`}>
      <span>{label}</span>
      <i><b className={`tier-${tier(value)}`} style={{ width: `${value}%` }} /></i>
      <strong>{value}{isDefault && <sup>*</sup>}</strong>
    </div>
  );
}

/** Profil symulacyjny zawodnika (SIM-02) w panelu szczegółów bazy zawodników. */
export function SimulationProfile({ resolution }: { resolution: ProfileResolution | undefined }) {
  if (!resolution) return null;
  if (!resolution.ok) {
    return (
      <section className="sim-profile sim-profile-error">
        <h3>Profil symulacyjny</h3>
        <p>Zawodnik nie może zagrać w meczu — dane profilu są niepoprawne:</p>
        <ul>{resolution.issues.map(issue => <li key={issue.path + issue.code}>{issue.message}</li>)}</ul>
      </section>
    );
  }

  const { profile } = resolution;
  const sources = Object.values(profile.sources);
  const defaults = sources.filter(source => source === 'role_default').length;
  const { strong, weak } = strengths(profile);

  return (
    <section className="sim-profile">
      <header>
        <h3>Profil symulacyjny</h3>
        <span className={`sim-overall tier-${tier(overallRating(profile))}`} title="Ocena ogólna na pozycji podstawowej (ważona umiejętnościami kluczowymi dla pozycji)">
          <b>{overallRating(profile)}</b>
          <small>ocena {profile.positions.primary}</small>
        </span>
      </header>
      {defaults > 0 && (
        <p className="sim-note">
          {defaults === sources.length
            ? 'Brak danych o zawodniku — wszystkie wartości to średnia dla pozycji.'
            : `${defaults} z ${sources.length} wartości to średnia dla pozycji.`}{' '}
          <span>* wartość domyślna</span>
        </p>
      )}
      <div className="sim-columns">
        <div>
          <h4>Umiejętności</h4>
          {skillKeys.map(key => <Bar key={key} label={skillLabels[key]} value={profile.skills[key]} source={profile.sources[`skills.${key}`]} />)}
        </div>
        <div>
          <h4>Atrybuty</h4>
          {attributeKeys.map(key => <Bar key={key} label={attributeLabels[key]} value={profile.attributes[key]} source={profile.sources[`attributes.${key}`]} />)}
          <h4>Pozycje</h4>
          <p className="sim-positions">
            <b className={`pos pos-${profile.positions.primary.toLowerCase()}`}>{profile.positions.primary}</b>
            {profile.positions.secondary.length > 0
              ? profile.positions.secondary.map(role => <b className={`pos pos-${role.toLowerCase()} secondary`} key={role}>{role}</b>)
              : <small>brak pozycji awaryjnych</small>}
          </p>
        </div>
      </div>
      <div className="empty-stats">
        <article>
          <h3>Mocne strony</h3>
          {strong.map(({ key, value }) => <p key={key}>{labelOf(key)} <b>{value}</b></p>)}
        </article>
        <article>
          <h3>Słabe strony</h3>
          {weak.map(({ key, value }) => <p key={key}>{labelOf(key)} <b>{value}</b></p>)}
        </article>
      </div>
    </section>
  );
}
