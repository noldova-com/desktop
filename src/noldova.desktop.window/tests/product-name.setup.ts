/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { productName } from "../../../_build/generated/product";
import { ProductName } from "../src/app/models/product-name";

ProductName.use(productName);
