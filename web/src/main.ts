// Self-hosted web fonts, latin subset only (spec 2, 7). Futura is never shipped.
import '@fontsource/jost/latin-400.css';
import '@fontsource/jost/latin-800.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import './styles/theme.css';

import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
