import React, { useEffect, useState, useRef } from 'react';
import { IonApp, IonRouterOutlet, IonSplitPane, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';
import Menu from './components/Menu';
import Page from './pages/Page';
import { databaseService } from './services/database';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';
import GraphView from './pages/GraphView/GraphView';

setupIonicReact();

const App: React.FC = () => {
  const [dbInitialized, setDbInitialized] = useState(false);
  const initializingRef = useRef(false);

  useEffect(() => {
    const initDatabase = async () => {
      if (dbInitialized || initializingRef.current) {
        return;
      }

      try {
        initializingRef.current = true;
        await databaseService.initialize();
        console.log('Database initialized successfully');
        setDbInitialized(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
      } finally {
        initializingRef.current = false;
      }
    };

    initDatabase();
  }, []);

  return (
    <IonApp>
      <IonReactRouter>
        <IonSplitPane contentId="main">
          <Menu />
          <IonRouterOutlet id="main">
            <Route path="/" exact={true}>
              <Redirect to="/folder/Inbox" />
            </Route>
            <Route path="/folder/:name" exact={true}>
              <Page />
            </Route>
            <Route path="/graph-view" exact={true}>
              {dbInitialized ? <GraphView /> : <div>Loading database...</div>}
            </Route>
          </IonRouterOutlet>
        </IonSplitPane>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
