import { createBrowserRouter } from 'react-router-dom'
import { App } from '../app'
import { EventsApp } from '../components/events/EventsApp'
import { UpcomingScreen } from '../components/events/UpcomingScreen'
import { MonthScreen } from '../components/events/MonthScreen'
import { NewUser } from './new-user'
import { NotFound } from './not-found'

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: [
        {
          element: <EventsApp />,
          children: [
            { index: true, element: <UpcomingScreen /> },
            { path: 'month', element: <MonthScreen /> },
          ],
        },
        { path: 'new-user', element: <NewUser /> },
        { path: '*', element: <NotFound /> },
      ],
    },
  ],
  { basename: '/events/' }
)
