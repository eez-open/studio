import { service } from "eez-studio-shared/service";

import { db } from "eez-studio-shared/db-path";

export default service<void, void>("db-services/vacuum", async () => {
    db.exec("VACUUM");
});
