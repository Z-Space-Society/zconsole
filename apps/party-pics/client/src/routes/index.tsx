import { createBrowserRouter } from 'react-router-dom'
import { App } from '../app'
import { Home } from './home'
import { CreateEvent } from './create-event'
import { Gallery } from './gallery'
import { Detail } from './detail'
import { NotFound } from './not-found'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'create-event', element: <CreateEvent /> },
      { path: 'events/:eventId', element: <Gallery /> },
      { path: 'events/:eventId/:photoId', element: <Detail /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
