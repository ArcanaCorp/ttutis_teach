import { Blobatar } from "@blobatar/react-native";

export default function Avatar ({ name, size=24 }) {
    return <Blobatar name={name} size={size} />;
}
