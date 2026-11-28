import { useEffect, useState } from 'react';
import { CopilotChat } from '@copilotkit/react-core/v2';
import { ArrowRight, Check, Clapperboard, Layers3, LayoutTemplate, Sparkles } from 'lucide-react';
import PosterCanvas from './canvas/PosterCanvas';

type Starter = { title: string; description: string; prompt: string; icon: typeof LayoutTemplate };

const starters: Starter[] = [
  {
    title: 'Créer une affiche',
    description: 'Événement, promotion ou lancement',
    prompt: 'Aide-moi à créer une affiche professionnelle. Commence par me demander les informations essentielles qui manquent, puis propose une composition éditable.',
    icon: LayoutTemplate,
  },
  {
    title: 'Créer un visuel de vente',
    description: 'Mettre un produit au premier plan',
    prompt: 'Aide-moi à concevoir un visuel publicitaire professionnel pour mon produit. Demande-moi d’abord les détails indispensables et les visuels que je possède.',
    icon: Sparkles,
  },
];

function App() {
  const [agentStatus, setAgentStatus] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  useEffect(() => {
    let cancelled = false;
    fetch('/api/copilotkit/info')
      .then((response) => { if (!cancelled) setAgentStatus(response.ok ? 'ready' : 'unavailable'); })
      .catch(() => { if (!cancelled) setAgentStatus('unavailable'); });
    return () => { cancelled = true; };
  }, []);

  const startFromPrompt = (prompt: string) => {
    if (agentStatus !== 'ready') return;
    const input = document.querySelector<HTMLTextAreaElement>('.aurora-chat textarea');
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(input, prompt);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  };

  const statusText = agentStatus === 'ready'
    ? 'Agent prêt'
    : agentStatus === 'checking'
      ? 'Connexion…'
      : 'Agent indisponible';

  return <div className="agent-app">
    <aside className="product-rail" aria-label="Navigation Aurora">
      <a className="rail-brand" href="/studio" aria-label="Aurora, studio de création">
        <span className="rail-brand-mark"><Sparkles size={19} strokeWidth={1.8} /></span>
        <span className="rail-brand-name">aurora</span>
      </a>
      <div className="rail-rule" />
      <div className="rail-group-label">STUDIOS</div>
      <button className="rail-studio active" aria-current="page" title="Studio graphique">
        <span className="rail-studio-icon"><LayoutTemplate size={18} /></span>
        <span className="rail-studio-copy"><strong>Graphique</strong><small>Affiches & visuels</small></span>
        <span className="rail-active-mark" />
      </button>
      <button className="rail-studio upcoming" disabled title="Studio d’interface — en préparation">
        <span className="rail-studio-icon"><Layers3 size={18} /></span>
        <span className="rail-studio-copy"><strong>Interface</strong><small>UX → UI · bientôt</small></span>
      </button>
      <button className="rail-studio upcoming" disabled title="Studio vidéo — en préparation">
        <span className="rail-studio-icon"><Clapperboard size={18} /></span>
        <span className="rail-studio-copy"><strong>Vidéo</strong><small>Motion · bientôt</small></span>
      </button>
      <div className="rail-group-label avatar-label">EXPLORER</div>
      <a className="rail-studio rail-studio-link" href="/butterfly" title="Découvrir l’avatar papillon 3D">
        <span className="rail-studio-icon"><Sparkles size={18} /></span>
        <span className="rail-studio-copy"><strong>Avatar Aurora</strong><small>Papillon 3D interactif</small></span>
      </a>
      <div className="rail-bottom">
        <div className="rail-local-status"><span /><div><strong>Espace de travail</strong><small>Enregistrement local</small></div></div>
      </div>
    </aside>

    <main className="conversation-side" id="studio">
      <header className="conversation-header">
        <div className="agent-identity">
          <span className="agent-mark"><Sparkles size={17} /></span>
          <div><strong>Studio graphique</strong><small><span className={`online-dot ${agentStatus === 'ready' ? 'is-ready' : ''}`} />{statusText}</small></div>
        </div>
        <span className="studio-step">01 <i /> CRÉATION</span>
      </header>
      <section className="conversation-body">
        <div className="studio-welcome">
          <span className="welcome-eyebrow">DU BRIEF AU VISUEL</span>
          <h1>Votre idée mérite<br />une <em>belle forme.</em></h1>
          <p>Décrivez ce que vous voulez créer. Aurora vous aide à composer un visuel professionnel, modifiable jusque dans ses détails.</p>
          <div className="welcome-steps" aria-label="Étapes de création">
            <span className="step-current"><b>1</b> Brief</span><i /><span><b>2</b> Composition</span><i /><span><b>3</b> Export</span>
          </div>
        </div>
        <div className="starter-panel">
          <div className="starter-heading"><span>POUR COMMENCER</span><small>Choisissez un point de départ</small></div>
          <div className="starter-grid">
            {starters.map(({ title, description, prompt, icon: Icon }) => <button
              key={title}
              className="starter-card"
              disabled={agentStatus !== 'ready'}
              onClick={() => startFromPrompt(prompt)}
            >
              <span className="starter-card-icon"><Icon size={17} /></span>
              <span className="starter-card-text"><strong>{title}</strong><small>{description}</small></span>
              <ArrowRight size={16} className="starter-arrow" />
            </button>)}
          </div>
        </div>
        {agentStatus === 'unavailable' && <div className="agent-notice" role="status">
          <span className="agent-notice-icon"><Check size={15} /></span>
          <div><strong>Votre espace de création reste disponible.</strong><p>L’agent IA n’est pas connecté. Vous pouvez toujours préparer et modifier votre affiche dans le canvas.</p></div>
        </div>}
        <div className="chat-section-label"><span>VOTRE ASSISTANT DE CRÉATION</span><span>Le canvas reste sous votre contrôle</span></div>
        <div className="aurora-chat-host">
          <CopilotChat
            agentId="default"
            className="aurora-chat"
            labels={{
              chatInputPlaceholder: 'Décrivez votre projet…',
              chatInputToolbarSendButtonLabel: 'Envoyer',
              chatInputToolbarStopButtonLabel: 'Arrêter',
              welcomeMessageText: 'Bonjour ! Quel visuel souhaitez-vous créer ?',
              chatDisclaimerText: 'Vos textes et vos calques restent modifiables.',
            }}
          />
        </div>
      </section>
    </main>
    <PosterCanvas />
  </div>;
}

export default App;
