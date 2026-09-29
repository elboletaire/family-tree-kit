/* Family history — views of the tree. scripts/build_site.py embeds this bundle and the data (DATA) in index.html */
import 'family-chart/styles/family-chart.css';
import { render } from 'solid-js/web';
import { App } from './App';
import { initData } from './data';
import { initFamily } from './family';
import { resumeSession } from './session';
import { initFocus } from './state';
import './web.css';

initData(DATA);
initFocus();
initFamily();
// Before drawing: with a session, the web waits for the private data (App shows the loading state meanwhile)
void resumeSession();
render(() => <App />, document.getElementById('app')!);
