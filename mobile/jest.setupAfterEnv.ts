import { configure } from "@testing-library/react-native";

// Paper dialogs animate when they close. Under parallel workers the animation can take longer
// than the default 1 s of waitFor/findBy, which made dialog tests fail only in full runs.
configure({ asyncUtilTimeout: 5000 });
