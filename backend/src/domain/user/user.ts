export interface UserProps {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  createdAt: Date;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class User {
  private readonly props: UserProps;

  private constructor(props: UserProps) {
    const email = props.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      throw new Error('Invalid email address');
    }
    this.props = { ...props, email };
  }

  static create(props: UserProps): User {
    return new User(props);
  }

  get id(): string { return this.props.id; }
  get email(): string { return this.props.email; }
  get name(): string { return this.props.name; }
  get avatarUrl(): string { return this.props.avatarUrl; }
  get createdAt(): Date { return this.props.createdAt; }

  withProfile(profile: { email: string; name: string; avatarUrl: string }): User {
    return new User({ ...this.props, ...profile });
  }
}
