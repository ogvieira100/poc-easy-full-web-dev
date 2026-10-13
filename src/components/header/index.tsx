import { NavLink } from 'react-router-dom'
import styles from './header.module.css'

export default function Header() {
  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <NavLink to="/" className={styles.brand}>
          <span className={styles.logo}>UR</span>
          <h1 className={styles.title}>Ui React</h1>
        </NavLink>
        <ul className={styles.links}>
          <li>
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `${styles.link} ${isActive ? styles.active : ''}`
              }
            >
              Home
            </NavLink>
          </li>
              <li>
            <NavLink
              to="/customers"
              end
              className={({ isActive }) =>
                `${styles.link} ${isActive ? styles.active : ''}`
              }
            >
              Customers
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/guids"
              end
              className={({ isActive }) =>
                `${styles.link} ${isActive ? styles.active : ''}`
              }
            >
              Guids
            </NavLink>
          </li> 
        </ul>
      </nav>
    </header>
  );
}
