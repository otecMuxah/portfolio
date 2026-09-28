import { CONTACTS, CV_SUMMARY, EDUCATION, PROFILE, ROLES, SKILLS } from './cv';

/** Everything the CV view can print, as one string. */
const allText = () => JSON.stringify({ PROFILE, CONTACTS, CV_SUMMARY, ROLES, SKILLS, EDUCATION });

describe('CV content', () => {
  it('carries the whole three-paragraph profile', () => {
    expect(CV_SUMMARY.length).toBe(3);
    expect(CV_SUMMARY[0]).toMatch(/^Engineering lead with over a decade/);
    expect(CV_SUMMARY[1]).toMatch(/Review is the human step; authoring largely is not\.$/);
    expect(CV_SUMMARY[2]).toMatch(/and I still write the hard ones myself\.$/);
  });

  it('lists every skills group of the CV, in its order', () => {
    expect(SKILLS.map((s) => s.area)).toEqual([
      'Languages',
      'Front End',
      'Back End',
      'Cloud & DevOps',
      'Testing & Quality',
      'CI/CD',
      'AI-Assisted Engineering',
      'Integrations',
      'Domains',
    ]);
  });

  it('lists every role, newest first', () => {
    expect(ROLES.map((r) => r.company)).toEqual([
      'International Air Transport Association',
      'Ciklum',
      'Deloitte',
      'Redstor',
      'Corporate Finance Institute',
      'PENTASOFT',
      'TEAM International',
      'Eastern Peak',
      'Raccoon Gang',
      'Webholder',
    ]);
  });

  it('names every IATA project', () => {
    const iata = ROLES[0].highlights.join(' ');
    for (const project of [
      'AI-Assisted Delivery:',
      'ATMPM:',
      'AMSS:',
      'ARM Index:',
      'ASPAC Portal:',
    ])
      expect(iata).toContain(project);
  });

  it('lists both degrees and both certifications', () => {
    expect(EDUCATION).toContain('HIPAA Certification - 2018 - 2019');
    expect(EDUCATION).toContain('Angular / Django Full-Stack Development - Udemy - 2020');
    expect(EDUCATION.filter((e) => e.startsWith("Master's Degree")).length).toBe(2);
  });

  it('states work authorisation and availability', () => {
    expect(PROFILE.workAuthorisation).toBe('German residence permit');
    expect(PROFILE.availability).toBe('4 weeks - works on contract via own entity');
  });

  it('publishes no phone number', () => {
    const text = allText();
    expect(text).not.toMatch(/tel:/i);
    expect(text).not.toMatch(/\+\d[\d\s().-]{7,}\d/);
    expect(text).not.toMatch(/phone/i);
  });
});
