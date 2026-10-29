import { Button } from './controls';
import type { CollectionProps } from './types';
import { ImageField, type ImageTools } from './ImageField';
import { Icon as SocialIcon } from '../../../packages/presentation/src/icons';
import { Icon } from './ui';
import { SharedSourceNotice } from './SharedSourceNotice';
export function SettingsPanel({ content, change, run, upload }: CollectionProps & ImageTools) {
  return (
    <div className="collection">
      <h1>Site settings</h1>
      {(['title', 'author', 'footer', 'description'] as const).map((field) => (
        <label key={field}>
          {
            {
              title: 'Website name',
              author: 'Author',
              footer: 'Footer',
              description: 'Default description',
              logo: 'Logo URL',
            }[field]
          }
          <input
            value={content.settings[field]}
            onChange={(e) => change((c) => ({ ...c, settings: { ...c.settings, [field]: e.target.value } }))}
          />
        </label>
      ))}
      <h2>Website logo</h2>
      <ImageField
        src={content.settings.logo}
        alt="Website logo"
        logo
        logoHelp="Used on the website and in Admin."
        run={run}
        upload={upload}
        onChange={(patch) => {
          if (patch.src !== undefined)
            change((c) => ({ ...c, settings: { ...c.settings, logo: patch.src! } }));
        }}
      />
      <h2>Contact links</h2>
      <SharedSourceNotice content={content} source="contacts" />
      {content.settings.contacts.map((contact, index) => (
        <div className="card" key={index}>
          <span className="contact-icon-preview">
            <SocialIcon name={contact.icon} />
          </span>
          {(['label', 'url'] as const).map((field) => (
            <label key={field}>
              {field === 'label' ? 'Label' : 'Link'}
              <input
                value={contact[field]}
                onChange={(e) =>
                  change((c) => ({
                    ...c,
                    settings: {
                      ...c.settings,
                      contacts: c.settings.contacts.map((item, i) =>
                        i === index ? { ...item, [field]: e.target.value } : item,
                      ),
                    },
                  }))
                }
              />
            </label>
          ))}
          <label>
            Icon
            <select
              value={contact.icon}
              onChange={(e) =>
                change((c) => ({
                  ...c,
                  settings: {
                    ...c.settings,
                    contacts: c.settings.contacts.map((item, i) =>
                      i === index ? { ...item, icon: e.target.value as typeof contact.icon } : item,
                    ),
                  },
                }))
              }
            >
              {Object.entries({
                scholar: 'Google Scholar',
                linkedin: 'LinkedIn',
                github: 'GitHub',
                twitter: 'Twitter',
                instagram: 'Instagram',
                wechat: 'WeChat',
                link: 'Website',
              }).map(([icon, label]) => (
                <option key={icon} value={icon}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Button
            onClick={() =>
              change((c) => ({
                ...c,
                settings: { ...c.settings, contacts: c.settings.contacts.filter((_, i) => i !== index) },
              }))
            }
          >
            <Icon name="trash" /> Delete contact
          </Button>
        </div>
      ))}
      <Button
        onClick={() =>
          change((c) => ({
            ...c,
            settings: {
              ...c.settings,
              contacts: [...c.settings.contacts, { label: 'Link', url: 'https://example.com', icon: 'link' }],
            },
          }))
        }
      >
        <Icon name="add" /> Add contact
      </Button>
    </div>
  );
}
