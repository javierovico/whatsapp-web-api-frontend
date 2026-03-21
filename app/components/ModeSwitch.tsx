"use client";

import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import NoSsr from "@mui/material/NoSsr";
import Select from "@mui/material/Select";
import { useColorScheme } from "@mui/material/styles";

export default function ModeSwitch() {
  const { mode, setMode } = useColorScheme();

  return (
    <NoSsr>
      {!mode ? null : (
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="mode-select-label">Tema</InputLabel>
          <Select
            labelId="mode-select-label"
            id="mode-select"
            value={mode}
            label="Tema"
            onChange={(event) => setMode(event.target.value as "system" | "light" | "dark")}
          >
            <MenuItem value="system">System</MenuItem>
            <MenuItem value="light">Light</MenuItem>
            <MenuItem value="dark">Dark</MenuItem>
          </Select>
        </FormControl>
      )}
    </NoSsr>
  );
}
