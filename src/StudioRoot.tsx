import { CopilotKitProvider } from '@copilotkit/react-core/v2';
import { standardUI, type GenerativeUITheme } from '@copilotkit/react-core/v2/generative-ui';
import '@copilotkit/react-core/v2/styles.css';
import App from './App';
import './style.css';
import './studio.css';

const auroraTheme: GenerativeUITheme = {
  '--a2ui-color-text-default': '#252620',
  '--a2ui-color-text-prose': '#454740',
  '--a2ui-color-text-primary': '#252620',
  '--a2ui-color-text-emphasis': '#1e201c',
  '--a2ui-color-text-secondary': '#777870',
  '--a2ui-color-text-tertiary': '#999b93',
  '--a2ui-color-surface': '#fffdf8',
  '--a2ui-color-surface-secondary': '#f6f6f3',
  '--a2ui-color-surface-tertiary': '#efeee9',
  '--a2ui-color-surface-elevated': '#ffffff',
  '--a2ui-color-surface-elevated-secondary': '#fbfbfa',
  '--a2ui-color-surface-inverted': '#252620',
  '--a2ui-color-surface-soft': '#f7f4ec',
  '--a2ui-color-border-default': '#e9e9e4',
  '--a2ui-color-border-subtle': '#f1f0eb',
  '--a2ui-color-border-strong': '#d9d8d0',
  '--a2ui-color-accent': '#ed6848',
  '--a2ui-color-on-accent': '#fffdf8',
  '--a2ui-color-panel': '#ffffff',
  '--a2ui-color-control': '#ffffff',
  '--a2ui-color-focus': '#8d81cf',
  '--a2ui-color-info-soft': 'rgba(106, 131, 235, 0.10)',
  '--a2ui-color-warning-soft': 'rgba(201, 161, 91, 0.12)',
  '--a2ui-color-success-soft': 'rgba(82, 117, 94, 0.10)',
  '--a2ui-color-danger-soft': 'rgba(182, 83, 65, 0.10)',
  '--a2ui-color-chart-cursor': 'rgba(37, 38, 32, 0.05)',
  '--a2ui-chart-1': '#ed6848',
  '--a2ui-chart-2': '#6a83eb',
  '--a2ui-chart-3': '#52755e',
  '--a2ui-chart-4': '#c5a15b',
  '--a2ui-chart-5': '#b6a0ef',
  '--a2ui-chart-6': '#54564f',
  '--a2ui-radius-sm': '8px',
  '--a2ui-radius-md': '12px',
  '--a2ui-radius-lg': '16px',
  '--a2ui-font-family': "'DM Sans', sans-serif",
  '--a2ui-shadow-soft': '0 4px 20px rgba(37, 38, 32, 0.08)',
  dark: {
    '--a2ui-color-text-default': '#f4f1e9',
    '--a2ui-color-text-prose': '#e3dfd5',
    '--a2ui-color-text-primary': '#f4f1e9',
    '--a2ui-color-text-emphasis': '#fffdf8',
    '--a2ui-color-text-secondary': '#c0bdb3',
    '--a2ui-color-text-tertiary': '#a09e96',
    '--a2ui-color-surface': '#252620',
    '--a2ui-color-surface-secondary': '#30322d',
    '--a2ui-color-surface-tertiary': '#393b35',
    '--a2ui-color-surface-elevated': '#30322d',
    '--a2ui-color-surface-elevated-secondary': '#393b35',
    '--a2ui-color-surface-inverted': '#fffdf8',
    '--a2ui-color-surface-soft': '#2c2d27',
    '--a2ui-color-border-default': 'rgba(255, 253, 248, 0.14)',
    '--a2ui-color-border-subtle': 'rgba(255, 253, 248, 0.08)',
    '--a2ui-color-border-strong': '#565850',
    '--a2ui-color-accent': '#ed6848',
    '--a2ui-color-on-accent': '#fffdf8',
    '--a2ui-color-panel': '#30322d',
    '--a2ui-color-control': '#393b35',
    '--a2ui-color-focus': '#b6a0ef',
  },
};

export default function StudioRoot() {
  return <CopilotKitProvider runtimeUrl="/api/copilotkit" agentId="default" generativeUI={{ ui: standardUI, theme: auroraTheme }}>
    <App />
  </CopilotKitProvider>;
}
